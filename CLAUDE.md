# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml` is committed). Dev server runs on `http://localhost:3000`.

```bash
pnpm install        # install deps (runs `nuxt prepare` via postinstall)
pnpm dev            # start dev server
pnpm build          # production build (Nitro server output)
pnpm generate       # static prerender
pnpm preview        # preview the production build locally
```

No test, lint, or typecheck scripts are configured yet. Type checking relies on Nuxt's generated `.nuxt/tsconfig.*.json` references — run `pnpm dev` (or `nuxt prepare`) at least once to generate them before TS will resolve.

## Current state

The repo is currently the **Nuxt 4 minimal starter** — `app/app.vue` renders `<NuxtWelcome />` and nothing else has been implemented. There are no routes, components, server routes, or composables yet. Treat almost everything below as *to be built*.

## What this project is (the assignment)

The full spec lives in `docs/assignment.md` (in Czech) — **read it before building features.** It is a hiring take-home, not an open-ended product. Summary:

**FirmaCheck** verifies a Czech company by its IČO (company registration number). User enters an IČO (required) and optionally a company name, clicks "Ověřit firmu" (Verify company), and the app:

1. Fetches company data from the **ARES API** (Czech business register) and shows IČO, legal name, legal form, founding date, subject status, registered address, and DIČ (VAT ID) if available.
2. Reports a **verification status** (found / not found / load error / loaded from ARES API / loaded from SQLite cache).
3. If a name was entered, does a normalized **name match** (match / partial / mismatch — ignoring case, spaces, basic punctuation).
4. Geocodes the address and shows the **company HQ on a map** (Mapy.cz / Mapy.com preferred; any free geocoding API is acceptable if justified in the README), including coordinates and a link to open the address in maps.
5. Maintains a **SQLite cache** for both ARES responses and geocoding results, and visibly shows whether each piece of data came from API or cache.
6. Lets the user **save verified companies** to a persistent list (name, IČO, address, last-verified date; clickable to re-open detail; removable; survives page reload).
7. **Exports** the saved list to CSV (with header row, real data only). Bonus: JSON export, copy-JSON-to-clipboard, per-company export.

Also required: responsive UI, basic IČO validation, error states, at least one **AI-generated visual element** (documented in README with tool + prompt), and a thorough `README.md`.

### Hard constraints that drive architecture

- **No runtime LLM APIs** (OpenAI/Anthropic/Gemini). AI tools are for development/design/docs only; the app runs on plain logic + ARES + geocoding + SQLite.
- **Deploys to Vercel or Netlify** — these are serverless with no persistent filesystem, so classic server-side SQLite (`better-sqlite3`, `sqlite3`) will NOT persist between requests. Pick and document one approach: browser-side SQLite via WASM (sql.js / wa-sqlite, persisted in IndexedDB/OPFS), cloud SQLite (Turso / libSQL), or a non-serverless backend. The assignment suggests using the *same* storage mechanism for both the cache and the saved-companies list to keep the architecture unified.

### Deliverables to track

Public GitHub repo, live Vercel/Netlify demo, and a `README.md` covering: app description, demo link, local setup, tech stack, APIs used, how the SQLite cache works, how companies are stored, CSV/JSON export, AI tools used, ≥3 example prompts, ≥2 development iterations, and future improvements.

## Conventions

Standard Nuxt 4 layout: app code under `app/`, auto-imported components/composables, file-based routing under `app/pages/`, server/API routes under `server/`. `compatibilityDate` is pinned in `nuxt.config.ts`.
