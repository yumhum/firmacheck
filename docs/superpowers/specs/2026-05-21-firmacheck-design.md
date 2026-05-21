# FirmaCheck — Design Spec

**Date:** 2026-05-21
**Status:** Approved for planning
**Source of truth:** `docs/assignment.md` (Czech). This spec must satisfy every requirement there. Where this spec and the assignment disagree, the assignment wins.

## 1. Purpose

A web app that verifies a Czech company by its IČO. The user enters an IČO (required) and optionally a company name, clicks **Ověřit firmu**, and the app fetches data from the ARES register, geocodes the registered address and shows it on a map, lets the user save verified companies to a persistent list, and exports that list to CSV/JSON.

## 2. Key decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Hosting | **Self-host via Coolify** (Docker container), no Vercel/Netlify | Assignment explicitly permits *vlastní server* in the SQLite section. Self-hosting gives a persistent filesystem, so we can use real server-side SQLite. Justify the Vercel/Netlify deviation in README. |
| Framework | **Nuxt 4** (already scaffolded) | Nitro server routes host the backend in one repo/deploy; Node server output runs as a long-lived process. Documented as Varianta C. |
| Storage | **`better-sqlite3`**, single file under `data/` | Most literal reading of "jednoduchá SQLite cache". Synchronous, simple, fast. Server-side persistent filesystem makes it trivial. |
| Cache | ARES responses + geocode results, **no TTL** | Assignment only requires "second lookup uses cache". `fetched_at` stored so we could expire later and can display it. |
| Geocoding/map | **Mapy.cz API** (geocode server-side) + **Leaflet** with Mapy.cz tiles | Assignment's stated preference. Geocode key stays server-side and is cached. |
| Saved companies | **Server-side SQLite**, global list (no auth) | Assignment's "unified architecture" hint. Trade-off (one global list, no per-user separation) documented in README. |
| UI | **Nuxt UI** components throughout | Per user requirement. |
| Form validation | **Zod schema via Nuxt UI `<UForm>`**, reused server-side | Per user requirement: native Nuxt UI form validation, no exceptions. One schema = single source of truth client + server. |

## 3. Architecture

The browser never calls ARES or Mapy.cz directly. All external calls route through Nitro server routes, which lets us hide the Mapy key, cache every response in SQLite, and report the data source to the UI.

```
Browser (Vue + Nuxt UI)
   │  POST /api/verify { ico, name? }
   ▼
Nitro /server/api/*  ──> ARES API (registry lookup)
   │                 └─> Mapy.cz geocode
   └─> better-sqlite3 (ares_cache, geocode_cache, saved_companies)
```

### Verify flow (`POST /api/verify`)

1. Server validates `{ ico, name? }` against the shared Zod schema (IČO format + mod-11 checksum).
2. Look up `ares_cache[ico]`. Hit → use cached payload, `aresSource = "cache"`. Miss → call ARES, store payload + `fetched_at`, `aresSource = "api"`. ARES 404 → status `not_found`. Network/5xx → status `error`.
3. Take the registered address, normalize it, look up `geocode_cache[address_norm]`. Hit/miss same pattern → `{ lat, lon }` + `geoSource`. Mapy failure degrades gracefully (return company data, no coordinates).
4. If `name` was supplied, compute name match (`match` / `partial` / `mismatch`).
5. Respond with: company fields, `aresSource`, `geoSource`, coordinates, name-match result, overall status.

The response carries both source flags so the UI can show e.g. `ARES: API`, `Geocoding: cache` (requirement #5's visible-source rule).

## 4. Data model

SQLite file `data/firmacheck.db` (mounted on a Coolify persistent volume).

```sql
ares_cache (
  ico         TEXT PRIMARY KEY,
  payload     TEXT NOT NULL,        -- JSON of normalized ARES company shape
  fetched_at  TEXT NOT NULL         -- ISO timestamp
);

geocode_cache (
  address_norm TEXT PRIMARY KEY,    -- normalized address used as cache key
  lat          REAL NOT NULL,
  lon          REAL NOT NULL,
  fetched_at   TEXT NOT NULL
);

saved_companies (
  ico              TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  legal_form       TEXT,
  status           TEXT,            -- subject status (active/etc.)
  address          TEXT,
  founded_date     TEXT,
  dic              TEXT,
  last_source      TEXT,            -- 'api' | 'cache' at last verify
  lat              REAL,
  lon              REAL,
  saved_at         TEXT NOT NULL,
  last_verified_at TEXT NOT NULL
);
```

## 5. Server API (Nitro `server/api/`)

| Route | Purpose |
|---|---|
| `POST /api/verify` | Orchestrator described in §3. Returns company + source flags + geo + name match + status. |
| `GET /api/companies` | List saved companies. |
| `POST /api/companies` | Save/upsert a verified company by IČO. |
| `DELETE /api/companies/:ico` | Remove a saved company. |
| `GET /api/companies/export?format=csv\|json` | Streamed download with correct `Content-Type` + `Content-Disposition`. Generated server-side from real saved rows, with header row. |

### `server/utils/`

- `db.ts` — `better-sqlite3` connection singleton + schema bootstrap (CREATE TABLE IF NOT EXISTS).
- `ares.ts` — fetch from ARES, map raw JSON → normalized company shape.
- `mapy.ts` — geocode an address via Mapy.cz (`X-Mapy-Api-Key` header), return `{ lat, lon }` or null.
- `ico.ts` — IČO validation incl. mod-11 checksum; address normalization helper for the geocode cache key.
- `nameMatch.ts` — normalize + compare names.

### `shared/` (or `app/`/`server/` shared location)

- `schema.ts` — Zod schema for the verify input, imported by both the client form and `/api/verify`.

## 6. External APIs

### ARES
- Endpoint: `GET https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`, header `Accept: application/json`. A 404 / fetch error → status `not_found`. (Confirmed from prior project `yumhum/fz` `composables/useAres.js`.)
- Confirmed response fields (from `fz`): `ico`, `obchodniJmeno`, `dic` (optional), and `sidlo` address object with `nazevUlice`, `cisloDomovni`, `cisloOrientacni`, `nazevObce`, `psc`, and **`sidlo.textovaAdresa`** (full formatted address string — use as the Mapy.cz geocode query input).
- Additional fields required by the assignment but not used in `fz` — **právní forma, datum vzniku, stav subjektu** — exist in the same response (`pravniForma`, `datumVzniku`, plus a registration/status section). Confirm exact field names + the legal-form code→label mapping against official ARES docs at implementation time.
- Map at least: IČO, obchodní název, právní forma, datum vzniku, stav subjektu, adresa sídla, DIČ (if present).

### Mapy.cz
- Geocode: `GET https://api.mapy.cz/v1/geocode?query=<addr>&lang=cs&limit=1&type=regional.address`, header `X-Mapy-Api-Key: <key>`. Response `items[0].position.{lat, lon}`. (Pattern confirmed from prior project `~/Work/vet-dir-v2`; verify current endpoint/domain `api.mapy.cz` vs `api.mapy.com` against official docs.)
- Map tiles: Leaflet with Mapy.cz tile layer (requires API key in tile URL — this key is client-exposed, unavoidable for keyed tiles; required Mapy attribution included).
- Key supplied as `MAPY_API_KEY` env var (Coolify).

## 7. Frontend (single page `/`, Nuxt UI)

- **VerifyForm** — `<UForm>` bound to the Zod schema. IČO field (required, validated incl. checksum) + optional name field + **Ověřit firmu** submit. Inline styled validation errors; submit blocked until valid.
- **CompanyDetail** — status banner (found / not found / error) + source badges (`ARES: API|cache`, `Geocoding: API|cache`); all ARES fields; name-match line (e.g. *Zadaný název „ideabox" odpovídá firmě „ideabox s.r.o."*); **MapView**; **Uložit firmu** button.
- **MapView** — Leaflet map, marker at HQ, displayed coordinates, "open in Mapy.cz" link. Hidden/placeholder if geocoding failed.
- **SavedCompanies** — list showing name, IČO, address, last-verified date; click a row to reopen its detail; remove button; **Export CSV**, **Export JSON**, **Copy JSON** actions; empty-state handling.
- **AI visual element** — one AI-generated illustration (empty-state of the saved list). Tool + exact prompt + rationale documented in README.

## 8. Validation, matching, errors

- **IČO validation:** 8 digits + official mod-11 checksum (not just length). Enforced in Zod schema (client + server).
- **Name match:** normalize both names — lowercase, strip whitespace, punctuation, common legal-form suffixes (`s.r.o.`, `a.s.`, etc.) — then: exact → `match`, substring containment → `partial`, else `mismatch`.
- **Error states (distinct UI):** invalid IČO (client, pre-submit); company not found (ARES 404); API/network failure; Mapy geocode failure (degrade: show data, no map).

## 9. Deployment (Coolify / Docker)

- `Dockerfile`: Node base capable of compiling the `better-sqlite3` native module (build toolchain in build stage). `nuxt build` → run the Node server output (`node .output/server/index.mjs`).
- **Persistent volume** mounted at the `data/` directory so `firmacheck.db` survives redeploys. (Critical — without this the DB resets every deploy.)
- Env vars via Coolify: `MAPY_API_KEY` (and any ARES base URL if parameterized).
- `better-sqlite3` marked external in the Nitro bundle (native module, not bundleable).

## 10. README requirements (assignment §README)

Must include: app description, live demo link, local setup instructions, tech stack, APIs used, SQLite cache explanation, saved-companies storage explanation, CSV/JSON export explanation, AI tools used, **≥3 example prompts**, **≥2 development iterations**, future improvements. Also: justification for self-hosting instead of Vercel/Netlify, and the global-saved-list (no auth) trade-off.

## 11. Out of scope (YAGNI)

- No authentication / per-user accounts.
- No cache TTL / invalidation (persistent cache only).
- No runtime LLM APIs (assignment forbids; AI used only for development/design/docs/visual asset).
- No production-grade DB; SQLite is sufficient per the assignment.
