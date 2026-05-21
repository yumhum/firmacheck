# FirmaCheck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build FirmaCheck — a Nuxt 4 web app that verifies a Czech company by IČO via ARES, geocodes and maps its registered seat via Mapy.cz, caches both in server-side SQLite, and lets users save companies and export them to CSV/JSON.

**Architecture:** Single Nuxt 4 app. The browser calls Nitro server routes only; those routes call ARES + Mapy.cz, cache every response in a `better-sqlite3` database on a persistent volume, and report the data source back to the UI. Saved companies live in the same SQLite DB (global, no auth). UI is built with Nuxt UI; the verify form uses a Zod schema reused on client and server. Deployed as a Docker container via Coolify.

**Tech Stack:** Nuxt 4, Nitro, Vue 3, Nuxt UI, Zod, better-sqlite3, Leaflet + Mapy.cz tiles, Vitest, Docker.

**Reference spec:** `docs/superpowers/specs/2026-05-21-firmacheck-design.md`. The assignment (`docs/assignment.md`) is the ultimate source of truth.

**Conventions for every task:** run `pnpm` for scripts. Commit after each task with a Conventional Commit message. Pure-logic utilities are developed test-first with Vitest; HTTP endpoints and UI are verified with the explicit `curl`/browser checks given in their tasks.

---

## File Structure

**Shared (client + server):**
- `shared/types.ts` — `CompanyData`, `VerifyResult`, `SavedCompany`, `CacheSource`, `NameMatch`.
- `shared/ico.ts` — `isValidIco` (mod-11 checksum), `normalizeAddress`.
- `shared/nameMatch.ts` — `matchName`.
- `shared/schema.ts` — Zod `verifySchema` (reused by the form and `/api/verify`).
- `shared/legalForms.ts` — ARES legal-form code → Czech label.

**Server:**
- `server/utils/db.ts` — `better-sqlite3` singleton + schema bootstrap.
- `server/utils/ares.ts` — `fetchAresCompany`, `mapAresResponse`, `AresNotFoundError`.
- `server/utils/mapy.ts` — `geocode`.
- `server/utils/csv.ts` — `buildCsv`, `toJson`.
- `server/api/verify.post.ts`
- `server/api/companies/index.get.ts`
- `server/api/companies/index.post.ts`
- `server/api/companies/[ico].delete.ts`
- `server/api/companies/export.get.ts`

**App (UI):**
- `app/app.vue` — `UApp` wrapper.
- `app/pages/index.vue` — single page, owns state, orchestrates components.
- `app/components/VerifyForm.vue`
- `app/components/CompanyDetail.vue`
- `app/components/MapView.client.vue` — Leaflet (client only).
- `app/components/SavedCompanies.vue`
- `app/assets/css/main.css` — Nuxt UI styles.
- `app/assets/img/empty-state.png` — AI-generated illustration.

**Config / ops:**
- `nuxt.config.ts`, `vitest.config.ts`, `.env.example`, `Dockerfile`, `.dockerignore`, `README.md`.

**Tests:**
- `test/ico.test.ts`, `test/nameMatch.test.ts`, `test/ares.test.ts`, `test/csv.test.ts`, `test/fixtures/ares-ideabox.json`.

---

## Task 1: Project setup — dependencies, Nuxt UI, Vitest

**Files:**
- Modify: `package.json`
- Modify: `nuxt.config.ts`
- Create: `app/assets/css/main.css`
- Create: `vitest.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Install dependencies**

Run:
```bash
pnpm add @nuxt/ui zod better-sqlite3 leaflet
pnpm add -D vitest @types/better-sqlite3 @types/leaflet
```
Expected: packages added to `package.json`, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure Nuxt**

Replace `nuxt.config.ts` with:
```ts
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    mapyApiKey: '', // set via NUXT_MAPY_API_KEY
    dbPath: './data/firmacheck.db', // set via NUXT_DB_PATH
    public: {
      mapyApiKey: '', // set via NUXT_PUBLIC_MAPY_API_KEY (used for client-side map tiles)
    },
  },
  nitro: {
    // better-sqlite3 is a native module — keep it external, never bundle it
    externals: { external: ['better-sqlite3'] },
  },
})
```

- [ ] **Step 4: Add Nuxt UI stylesheet**

Create `app/assets/css/main.css`:
```css
@import "tailwindcss";
@import "@nuxt/ui";
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Add env example**

Create `.env.example`:
```bash
# Mapy.cz / Mapy.com API key (https://developer.mapy.com)
NUXT_MAPY_API_KEY=your_key_here
NUXT_PUBLIC_MAPY_API_KEY=your_key_here
# Path to the SQLite database file
NUXT_DB_PATH=./data/firmacheck.db
```

- [ ] **Step 7: Verify dev server boots**

Run: `pnpm dev` (then stop it with Ctrl-C after it prints the local URL).
Expected: Nuxt starts without errors and prints `http://localhost:3000`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Nuxt UI, SQLite, Leaflet, Zod, and Vitest setup"
```

---

## Task 2: Shared types

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: Create the shared types**

Create `shared/types.ts`:
```ts
export type CacheSource = 'api' | 'cache'
export type NameMatch = 'match' | 'partial' | 'mismatch'

export interface CompanyData {
  ico: string
  name: string // obchodniJmeno
  legalForm: string // human label, e.g. "Společnost s ručením omezeným"
  legalFormCode: string // raw ARES code, e.g. "112"
  foundedDate: string | null // ISO date, e.g. "2014-03-26"
  status: string // e.g. "Aktivní"
  address: string // sidlo.textovaAdresa
  dic: string | null
}

export interface VerifyResult {
  status: 'found' | 'not_found' | 'error'
  company: CompanyData | null
  aresSource: CacheSource | null
  geo: { lat: number, lon: number } | null
  geoSource: CacheSource | null
  nameMatch: NameMatch | null
  message?: string
}

export interface SavedCompany extends CompanyData {
  lat: number | null
  lon: number | null
  lastSource: CacheSource
  savedAt: string // ISO timestamp
  lastVerifiedAt: string // ISO timestamp
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add shared domain types"
```

---

## Task 3: IČO validation + address normalization (TDD)

**Files:**
- Create: `shared/ico.ts`
- Test: `test/ico.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/ico.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isValidIco, normalizeAddress } from '../shared/ico'

describe('isValidIco', () => {
  it('accepts a valid IČO (correct mod-11 checksum)', () => {
    expect(isValidIco('02823519')).toBe(true) // ideabox s.r.o.
  })

  it('rejects an IČO with a wrong checksum', () => {
    expect(isValidIco('02823518')).toBe(false)
  })

  it('rejects non-8-digit input', () => {
    expect(isValidIco('123')).toBe(false)
    expect(isValidIco('abcdefgh')).toBe(false)
    expect(isValidIco('028235190')).toBe(false)
  })
})

describe('normalizeAddress', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeAddress('  Minická 376/2,   Čimice, 18100  Praha 8 '))
      .toBe('minická 376/2, čimice, 18100 praha 8')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- test/ico.test.ts`
Expected: FAIL — cannot resolve `../shared/ico`.

- [ ] **Step 3: Implement**

Create `shared/ico.ts`:
```ts
/**
 * Validates a Czech IČO: 8 digits with a mod-11 check digit.
 * Algorithm: weighted sum of the first 7 digits (weights 8..2),
 * check digit = (11 - (sum % 11)) % 10.
 */
export function isValidIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false
  const digits = ico.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 7; i++) {
    sum += digits[i]! * (8 - i)
  }
  const check = (11 - (sum % 11)) % 10
  return check === digits[7]
}

/** Normalizes an address into a stable cache key. */
export function normalizeAddress(address: string): string {
  return address.toLowerCase().trim().replace(/\s+/g, ' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- test/ico.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/ico.ts test/ico.test.ts
git commit -m "feat: add IČO checksum validation and address normalization"
```

---

## Task 4: Name matching (TDD)

**Files:**
- Create: `shared/nameMatch.ts`
- Test: `test/nameMatch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/nameMatch.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { matchName } from '../shared/nameMatch'

describe('matchName', () => {
  it('matches ignoring legal-form suffix, case, and punctuation', () => {
    expect(matchName('ideabox', 'ideabox s.r.o.')).toBe('match')
    expect(matchName('IDEABOX', 'ideabox s.r.o.')).toBe('match')
  })

  it('returns partial when one name contains the other', () => {
    expect(matchName('idea', 'ideabox s.r.o.')).toBe('partial')
  })

  it('returns mismatch for unrelated names', () => {
    expect(matchName('seznam', 'ideabox s.r.o.')).toBe('mismatch')
  })

  it('handles diacritics', () => {
    expect(matchName('ceska sporitelna', 'Česká spořitelna, a.s.')).toBe('match')
  })

  it('returns mismatch for empty input', () => {
    expect(matchName('', 'ideabox s.r.o.')).toBe('mismatch')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- test/nameMatch.test.ts`
Expected: FAIL — cannot resolve `../shared/nameMatch`.

- [ ] **Step 3: Implement**

Create `shared/nameMatch.ts`:
```ts
import type { NameMatch } from './types'

// Common Czech legal-form suffixes to strip before comparing.
const LEGAL_SUFFIXES
  = /\b(spol\.?\s*s\s*r\.?\s*o\.?|s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|v\.?\s*o\.?\s*s\.?|k\.?\s*s\.?|s\.?\s*p\.?|z\.?\s*s\.?|o\.?\s*p\.?\s*s\.?)\b/g

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(LEGAL_SUFFIXES, '')
    .replace(/[^a-z0-9]/g, '') // strip spaces and punctuation
}

/** Compares a user-entered name against the official ARES name. */
export function matchName(input: string, official: string): NameMatch {
  const a = normalize(input)
  const b = normalize(official)
  if (!a) return 'mismatch'
  if (a === b) return 'match'
  if (a.includes(b) || b.includes(a)) return 'partial'
  return 'mismatch'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- test/nameMatch.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/nameMatch.ts test/nameMatch.test.ts
git commit -m "feat: add company name matching"
```

---

## Task 5: Legal-form code map + verify Zod schema

**Files:**
- Create: `shared/legalForms.ts`
- Create: `shared/schema.ts`

- [ ] **Step 1: Create the legal-form map**

Create `shared/legalForms.ts`:
```ts
// ARES legal-form codes (číselník právních forem) — common subset.
const LEGAL_FORMS: Record<string, string> = {
  '100': 'Podnikající fyzická osoba',
  '101': 'Fyzická osoba podnikající dle živnostenského zákona',
  '111': 'Veřejná obchodní společnost',
  '112': 'Společnost s ručením omezeným',
  '113': 'Společnost komanditní',
  '115': 'Komanditní společnost',
  '121': 'Akciová společnost',
  '141': 'Obecně prospěšná společnost',
  '161': 'Ústav',
  '205': 'Družstvo',
  '301': 'Státní podnik',
  '331': 'Příspěvková organizace',
  '421': 'Odštěpný závod zahraniční právnické osoby',
  '706': 'Spolek',
  '736': 'Pobočný spolek',
  '751': 'Nadace',
  '801': 'Obec',
}

/** Returns the human label for an ARES legal-form code, or a fallback. */
export function legalFormLabel(code: string): string {
  return LEGAL_FORMS[code] ?? `Právní forma ${code}`
}
```

- [ ] **Step 2: Create the verify schema**

Create `shared/schema.ts`:
```ts
import { z } from 'zod'
import { isValidIco } from './ico'

export const verifySchema = z.object({
  ico: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'IČO musí mít přesně 8 číslic')
    .refine(isValidIco, 'Neplatné IČO (chybný kontrolní součet)'),
  name: z.string().trim().max(200, 'Název je příliš dlouhý').optional(),
})

export type VerifyInput = z.infer<typeof verifySchema>
```

- [ ] **Step 3: Verify it type-checks and the schema imports resolve**

Run: `pnpm test` (existing tests still pass; this confirms nothing is broken).
Expected: PASS (all tests from Tasks 3-4).

- [ ] **Step 4: Commit**

```bash
git add shared/legalForms.ts shared/schema.ts
git commit -m "feat: add legal-form labels and verify input schema"
```

---

## Task 6: ARES client + response mapping (TDD)

**Files:**
- Create: `test/fixtures/ares-ideabox.json`
- Create: `server/utils/ares.ts`
- Test: `test/ares.test.ts`

- [ ] **Step 1: Save the real ARES response as a fixture**

Run:
```bash
mkdir -p test/fixtures
curl -s -H "Accept: application/json" \
  "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/02823519" \
  -o test/fixtures/ares-ideabox.json
```
Expected: `test/fixtures/ares-ideabox.json` contains the JSON with `"ico":"02823519"`, `"obchodniJmeno":"ideabox s.r.o."`, `"pravniForma":"112"`, `"datumVzniku":"2014-03-26"`, `"dic":"CZ02823519"`, a `sidlo.textovaAdresa`, and a `seznamRegistraci` object.

- [ ] **Step 2: Write the failing test**

Create `test/ares.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import fixture from './fixtures/ares-ideabox.json'
import { mapAresResponse } from '../server/utils/ares'

describe('mapAresResponse', () => {
  const company = mapAresResponse(fixture)

  it('maps core identity fields', () => {
    expect(company.ico).toBe('02823519')
    expect(company.name).toBe('ideabox s.r.o.')
    expect(company.dic).toBe('CZ02823519')
  })

  it('maps the legal form code to a label', () => {
    expect(company.legalFormCode).toBe('112')
    expect(company.legalForm).toBe('Společnost s ručením omezeným')
  })

  it('maps founding date and seat address', () => {
    expect(company.foundedDate).toBe('2014-03-26')
    expect(company.address).toBe('Minická 376/2, Čimice, 18100 Praha 8')
  })

  it('derives an active status from the primary register', () => {
    expect(company.status).toBe('Aktivní')
  })

  it('returns null dic when missing', () => {
    const noDic = mapAresResponse({ ...fixture, dic: undefined })
    expect(noDic.dic).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- test/ares.test.ts`
Expected: FAIL — cannot resolve `../server/utils/ares`.

- [ ] **Step 4: Implement**

Create `server/utils/ares.ts`:
```ts
import type { CompanyData } from '../../shared/types'
import { legalFormLabel } from '../../shared/legalForms'

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty'

export class AresNotFoundError extends Error {
  constructor(ico: string) {
    super(`IČO ${ico} nebylo v rejstříku ARES nalezeno.`)
    this.name = 'AresNotFoundError'
  }
}

/** Derives a human status from the subject's primary register entry. */
function deriveStatus(raw: any): string {
  const src = typeof raw.primarniZdroj === 'string' ? raw.primarniZdroj : ''
  const key = src ? `stavZdroje${src.charAt(0).toUpperCase()}${src.slice(1)}` : ''
  const value: string | undefined = raw.seznamRegistraci?.[key]
  if (value === 'AKTIVNI') return 'Aktivní'
  if (value === 'ZANIKLY') return 'Zaniklý'
  return value ?? 'Neznámý'
}

/** Maps a raw ARES economic-subject response into our CompanyData shape. */
export function mapAresResponse(raw: any): CompanyData {
  const code = String(raw.pravniForma ?? raw.pravniFormaRos ?? '')
  return {
    ico: String(raw.ico),
    name: raw.obchodniJmeno ?? '',
    legalFormCode: code,
    legalForm: legalFormLabel(code),
    foundedDate: raw.datumVzniku ?? null,
    status: deriveStatus(raw),
    address: raw.sidlo?.textovaAdresa ?? '',
    dic: raw.dic ?? null,
  }
}

/**
 * Fetches a company from ARES by IČO.
 * Throws AresNotFoundError on 404, or a generic Error on other failures.
 */
export async function fetchAresCompany(ico: string): Promise<CompanyData> {
  let res: Response
  try {
    res = await fetch(`${ARES_BASE}/${ico}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
  }
  catch (error) {
    throw new Error(`ARES request failed: ${(error as Error).message}`)
  }

  if (res.status === 404) throw new AresNotFoundError(ico)
  if (!res.ok) throw new Error(`ARES returned ${res.status}`)

  const raw = await res.json()
  return mapAresResponse(raw)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- test/ares.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add server/utils/ares.ts test/ares.test.ts test/fixtures/ares-ideabox.json
git commit -m "feat: add ARES client and response mapping"
```

---

## Task 7: SQLite database utility

**Files:**
- Create: `server/utils/db.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Ignore the data directory**

Add to `.gitignore` (under the Nuxt outputs section):
```
# SQLite data
data
```

- [ ] **Step 2: Implement the DB singleton + schema**

Create `server/utils/db.ts`:
```ts
import { dirname } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

/** Returns a singleton better-sqlite3 connection, creating the schema on first use. */
export function useDb(): Database.Database {
  if (db) return db

  const dbPath = useRuntimeConfig().dbPath as string
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS ares_cache (
      ico        TEXT PRIMARY KEY,
      payload    TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS geocode_cache (
      address_norm TEXT PRIMARY KEY,
      lat          REAL NOT NULL,
      lon          REAL NOT NULL,
      fetched_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_companies (
      ico              TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      legal_form       TEXT,
      legal_form_code  TEXT,
      status           TEXT,
      address          TEXT,
      founded_date     TEXT,
      dic              TEXT,
      last_source      TEXT,
      lat              REAL,
      lon              REAL,
      saved_at         TEXT NOT NULL,
      last_verified_at TEXT NOT NULL
    );
  `)
  return db
}
```

- [ ] **Step 3: Verify it compiles by booting the server**

Run: `pnpm dev` (stop after it boots cleanly with Ctrl-C).
Expected: no errors; `data/firmacheck.db` is NOT yet created (the DB is lazy — created on first `useDb()` call).

- [ ] **Step 4: Commit**

```bash
git add server/utils/db.ts .gitignore
git commit -m "feat: add SQLite connection and schema bootstrap"
```

---

## Task 8: Mapy.cz geocoding utility

**Files:**
- Create: `server/utils/mapy.ts`

- [ ] **Step 1: Implement the geocoder**

Create `server/utils/mapy.ts`:
```ts
interface MapyGeocodeResponse {
  items?: Array<{ position?: { lat: number, lon: number } }>
}

/**
 * Geocodes an address string via the Mapy.cz REST API.
 * Returns coordinates, or null if no result / no key / request fails.
 */
export async function geocode(query: string): Promise<{ lat: number, lon: number } | null> {
  const apiKey = useRuntimeConfig().mapyApiKey as string
  if (!apiKey) {
    console.warn('[mapy] NUXT_MAPY_API_KEY not configured, skipping geocoding')
    return null
  }

  try {
    const url = new URL('https://api.mapy.cz/v1/geocode')
    url.searchParams.set('query', query)
    url.searchParams.set('lang', 'cs')
    url.searchParams.set('limit', '1')

    const res = await fetch(url, {
      headers: { 'X-Mapy-Api-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.warn(`[mapy] geocode error: ${res.status}`)
      return null
    }

    const data = await res.json() as MapyGeocodeResponse
    const pos = data.items?.[0]?.position
    if (!pos) return null
    return { lat: pos.lat, lon: pos.lon }
  }
  catch (error) {
    console.warn(`[mapy] geocode failed for "${query}": ${(error as Error).message}`)
    return null
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm dev` (stop after clean boot).
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/utils/mapy.ts
git commit -m "feat: add Mapy.cz geocoding utility"
```

---

## Task 9: CSV / JSON export builders (TDD)

**Files:**
- Create: `server/utils/csv.ts`
- Test: `test/csv.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/csv.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { SavedCompany } from '../shared/types'
import { buildCsv, toJson } from '../server/utils/csv'

const rows: SavedCompany[] = [
  {
    ico: '02823519',
    name: 'ideabox s.r.o.',
    legalForm: 'Společnost s ručením omezeným',
    legalFormCode: '112',
    foundedDate: '2014-03-26',
    status: 'Aktivní',
    address: 'Minická 376/2, Čimice, 18100 Praha 8',
    dic: 'CZ02823519',
    lat: 50.13,
    lon: 14.42,
    lastSource: 'api',
    savedAt: '2026-05-22T10:00:00.000Z',
    lastVerifiedAt: '2026-05-22T10:00:00.000Z',
  },
]

describe('buildCsv', () => {
  const csv = buildCsv(rows)

  it('starts with a UTF-8 BOM', () => {
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
  })

  it('has a header row with the required columns', () => {
    const header = csv.replace(/^﻿/, '').split('\n')[0]
    expect(header).toBe(
      'ico;obchodni_nazev;pravni_forma;stav;adresa;datum_vzniku;datum_overeni;zdroj;souradnice',
    )
  })

  it('includes the company data row', () => {
    expect(csv).toContain('02823519')
    expect(csv).toContain('ideabox s.r.o.')
    expect(csv).toContain('50.13, 14.42')
  })

  it('quotes and escapes fields containing the delimiter', () => {
    const tricky = buildCsv([{ ...rows[0]!, name: 'Firma; s.r.o.' }])
    expect(tricky).toContain('"Firma; s.r.o."')
  })
})

describe('toJson', () => {
  it('produces pretty-printed JSON of the rows', () => {
    expect(JSON.parse(toJson(rows))).toEqual(rows)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- test/csv.test.ts`
Expected: FAIL — cannot resolve `../server/utils/csv`.

- [ ] **Step 3: Implement**

Create `server/utils/csv.ts`:
```ts
import type { SavedCompany } from '../../shared/types'

const DELIMITER = ';'
const HEADER = [
  'ico',
  'obchodni_nazev',
  'pravni_forma',
  'stav',
  'adresa',
  'datum_vzniku',
  'datum_overeni',
  'zdroj',
  'souradnice',
]

function escape(value: string): string {
  if (value.includes(DELIMITER) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function row(c: SavedCompany): string {
  const coords = c.lat != null && c.lon != null ? `${c.lat}, ${c.lon}` : ''
  return [
    c.ico,
    c.name,
    c.legalForm,
    c.status,
    c.address,
    c.foundedDate ?? '',
    c.lastVerifiedAt,
    c.lastSource,
    coords,
  ].map(v => escape(String(v ?? ''))).join(DELIMITER)
}

/** Builds a UTF-8 (BOM-prefixed) CSV with a header row for Czech Excel. */
export function buildCsv(rows: SavedCompany[]): string {
  const lines = [HEADER.join(DELIMITER), ...rows.map(row)]
  return `﻿${lines.join('\n')}`
}

/** Pretty-prints saved companies as JSON. */
export function toJson(rows: SavedCompany[]): string {
  return JSON.stringify(rows, null, 2)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- test/csv.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/utils/csv.ts test/csv.test.ts
git commit -m "feat: add CSV and JSON export builders"
```

---

## Task 10: `POST /api/verify` endpoint

**Files:**
- Create: `server/api/verify.post.ts`

- [ ] **Step 1: Implement the endpoint**

Create `server/api/verify.post.ts`:
```ts
import type { CompanyData, VerifyResult } from '../../shared/types'
import { verifySchema } from '../../shared/schema'
import { normalizeAddress } from '../../shared/ico'
import { matchName } from '../../shared/nameMatch'
import { AresNotFoundError, fetchAresCompany } from '../utils/ares'
import { geocode } from '../utils/mapy'
import { useDb } from '../utils/db'

export default defineEventHandler(async (event): Promise<VerifyResult> => {
  const { ico, name } = await readValidatedBody(event, body => verifySchema.parse(body))
  const db = useDb()
  const now = new Date().toISOString()

  // --- ARES (cache first) ---
  let company: CompanyData
  let aresSource: 'api' | 'cache'
  const cachedAres = db
    .prepare('SELECT payload FROM ares_cache WHERE ico = ?')
    .get(ico) as { payload: string } | undefined

  if (cachedAres) {
    company = JSON.parse(cachedAres.payload)
    aresSource = 'cache'
  }
  else {
    try {
      company = await fetchAresCompany(ico)
    }
    catch (error) {
      if (error instanceof AresNotFoundError) {
        return { status: 'not_found', company: null, aresSource: null, geo: null, geoSource: null, nameMatch: null, message: error.message }
      }
      return { status: 'error', company: null, aresSource: null, geo: null, geoSource: null, nameMatch: null, message: 'Chyba při načítání dat z ARES.' }
    }
    db.prepare('INSERT OR REPLACE INTO ares_cache (ico, payload, fetched_at) VALUES (?, ?, ?)')
      .run(ico, JSON.stringify(company), now)
    aresSource = 'api'
  }

  // --- Geocoding (cache first) ---
  let geo: { lat: number, lon: number } | null = null
  let geoSource: 'api' | 'cache' | null = null
  if (company.address) {
    const key = normalizeAddress(company.address)
    const cachedGeo = db
      .prepare('SELECT lat, lon FROM geocode_cache WHERE address_norm = ?')
      .get(key) as { lat: number, lon: number } | undefined

    if (cachedGeo) {
      geo = { lat: cachedGeo.lat, lon: cachedGeo.lon }
      geoSource = 'cache'
    }
    else {
      const result = await geocode(company.address)
      if (result) {
        db.prepare('INSERT OR REPLACE INTO geocode_cache (address_norm, lat, lon, fetched_at) VALUES (?, ?, ?, ?)')
          .run(key, result.lat, result.lon, now)
        geo = result
        geoSource = 'api'
      }
    }
  }

  // --- Name match ---
  const nameMatch = name ? matchName(name, company.name) : null

  return { status: 'found', company, aresSource, geo, geoSource, nameMatch }
})
```

- [ ] **Step 2: Verify against the live ARES API (API source)**

Run (with `pnpm dev` running in another shell, and `NUXT_MAPY_API_KEY` set in `.env`):
```bash
curl -s -X POST http://localhost:3000/api/verify \
  -H 'Content-Type: application/json' \
  -d '{"ico":"02823519","name":"ideabox"}' | head -c 600; echo
```
Expected: JSON with `"status":"found"`, `"aresSource":"api"`, `company.name":"ideabox s.r.o."`, `"nameMatch":"match"`, and (if a Mapy key is set) a `geo` object with `geoSource":"api"`.

- [ ] **Step 3: Verify the cache path**

Run the same `curl` again.
Expected: identical company data but `"aresSource":"cache"` and `"geoSource":"cache"`.

- [ ] **Step 4: Verify error states**

Run:
```bash
curl -s -X POST http://localhost:3000/api/verify -H 'Content-Type: application/json' -d '{"ico":"00000001"}' | head -c 200; echo
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/verify -H 'Content-Type: application/json' -d '{"ico":"123"}'
```
Expected: first returns `"status":"not_found"`; second returns HTTP `400` (schema validation rejects the bad IČO).

- [ ] **Step 5: Commit**

```bash
git add server/api/verify.post.ts
git commit -m "feat: add /api/verify with ARES + geocode caching"
```

---

## Task 11: Saved-companies CRUD endpoints

**Files:**
- Create: `server/api/companies/index.get.ts`
- Create: `server/api/companies/index.post.ts`
- Create: `server/api/companies/[ico].delete.ts`

- [ ] **Step 1: Implement the list endpoint**

Create `server/api/companies/index.get.ts`:
```ts
import type { SavedCompany } from '../../../shared/types'
import { useDb } from '../../utils/db'

export default defineEventHandler((): SavedCompany[] => {
  const rows = useDb()
    .prepare('SELECT * FROM saved_companies ORDER BY saved_at DESC')
    .all() as Array<Record<string, unknown>>

  return rows.map(r => ({
    ico: r.ico as string,
    name: r.name as string,
    legalForm: r.legal_form as string,
    legalFormCode: r.legal_form_code as string,
    status: r.status as string,
    address: r.address as string,
    foundedDate: (r.founded_date as string) ?? null,
    dic: (r.dic as string) ?? null,
    lat: (r.lat as number) ?? null,
    lon: (r.lon as number) ?? null,
    lastSource: r.last_source as 'api' | 'cache',
    savedAt: r.saved_at as string,
    lastVerifiedAt: r.last_verified_at as string,
  }))
})
```

- [ ] **Step 2: Implement the save (upsert) endpoint**

Create `server/api/companies/index.post.ts`:
```ts
import { z } from 'zod'
import type { SavedCompany } from '../../../shared/types'
import { useDb } from '../../utils/db'

const saveSchema = z.object({
  ico: z.string().regex(/^\d{8}$/),
  name: z.string(),
  legalForm: z.string(),
  legalFormCode: z.string(),
  status: z.string(),
  address: z.string(),
  foundedDate: z.string().nullable(),
  dic: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  lastSource: z.enum(['api', 'cache']),
})

export default defineEventHandler(async (event): Promise<SavedCompany> => {
  const body = await readValidatedBody(event, data => saveSchema.parse(data))
  const now = new Date().toISOString()

  // Preserve original saved_at on re-save; always refresh last_verified_at.
  const existing = useDb()
    .prepare('SELECT saved_at FROM saved_companies WHERE ico = ?')
    .get(body.ico) as { saved_at: string } | undefined
  const savedAt = existing?.saved_at ?? now

  useDb().prepare(`
    INSERT OR REPLACE INTO saved_companies
      (ico, name, legal_form, legal_form_code, status, address, founded_date, dic,
       last_source, lat, lon, saved_at, last_verified_at)
    VALUES (@ico, @name, @legalForm, @legalFormCode, @status, @address, @foundedDate, @dic,
       @lastSource, @lat, @lon, @savedAt, @lastVerifiedAt)
  `).run({ ...body, savedAt, lastVerifiedAt: now })

  return { ...body, savedAt, lastVerifiedAt: now }
})
```

- [ ] **Step 3: Implement the delete endpoint**

Create `server/api/companies/[ico].delete.ts`:
```ts
import { useDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const ico = getRouterParam(event, 'ico')
  if (!ico || !/^\d{8}$/.test(ico)) {
    throw createError({ statusCode: 400, message: 'Neplatné IČO' })
  }
  useDb().prepare('DELETE FROM saved_companies WHERE ico = ?').run(ico)
  return { ok: true }
})
```

- [ ] **Step 4: Verify the full CRUD cycle**

Run (with `pnpm dev` running):
```bash
curl -s -X POST http://localhost:3000/api/companies -H 'Content-Type: application/json' \
  -d '{"ico":"02823519","name":"ideabox s.r.o.","legalForm":"Společnost s ručením omezeným","legalFormCode":"112","status":"Aktivní","address":"Minická 376/2, Čimice, 18100 Praha 8","foundedDate":"2014-03-26","dic":"CZ02823519","lat":50.13,"lon":14.42,"lastSource":"api"}' > /dev/null
curl -s http://localhost:3000/api/companies | head -c 400; echo
curl -s -X DELETE http://localhost:3000/api/companies/02823519 ; echo
curl -s http://localhost:3000/api/companies; echo
```
Expected: the list shows the saved company after POST, then `[]` after DELETE.

- [ ] **Step 5: Commit**

```bash
git add server/api/companies/index.get.ts server/api/companies/index.post.ts "server/api/companies/[ico].delete.ts"
git commit -m "feat: add saved-companies CRUD endpoints"
```

---

## Task 12: `GET /api/companies/export` endpoint

**Files:**
- Create: `server/api/companies/export.get.ts`

- [ ] **Step 1: Implement the export endpoint**

Create `server/api/companies/export.get.ts`:
```ts
import type { SavedCompany } from '../../../shared/types'
import { buildCsv, toJson } from '../../utils/csv'
import { useDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const format = (query.format as string) === 'json' ? 'json' : 'csv'
  // Optional ?ico= filter exports a single selected company (bonus).
  const ico = typeof query.ico === 'string' && /^\d{8}$/.test(query.ico) ? query.ico : null

  const rows = (ico
    ? useDb().prepare('SELECT * FROM saved_companies WHERE ico = ?').all(ico)
    : useDb().prepare('SELECT * FROM saved_companies ORDER BY saved_at DESC').all()
  ) as Array<Record<string, unknown>>

  const companies: SavedCompany[] = rows.map(r => ({
    ico: r.ico as string,
    name: r.name as string,
    legalForm: r.legal_form as string,
    legalFormCode: r.legal_form_code as string,
    status: r.status as string,
    address: r.address as string,
    foundedDate: (r.founded_date as string) ?? null,
    dic: (r.dic as string) ?? null,
    lat: (r.lat as number) ?? null,
    lon: (r.lon as number) ?? null,
    lastSource: r.last_source as 'api' | 'cache',
    savedAt: r.saved_at as string,
    lastVerifiedAt: r.last_verified_at as string,
  }))

  const base = ico ? `firmacheck-${ico}` : 'firmacheck-export'

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="${base}.json"`)
    return toJson(companies)
  }

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${base}.csv"`)
  return buildCsv(companies)
})
```

- [ ] **Step 2: Verify both formats download**

Run (save a company first if the DB is empty, using the POST from Task 11):
```bash
curl -s -D - "http://localhost:3000/api/companies/export?format=csv" -o /tmp/export.csv | grep -i 'content-disposition'
head -2 /tmp/export.csv
curl -s -D - "http://localhost:3000/api/companies/export?format=json" -o /dev/null | grep -i 'content-type'
# Single-company export (bonus)
curl -s -D - "http://localhost:3000/api/companies/export?format=csv&ico=02823519" -o /tmp/one.csv | grep -i 'content-disposition'
wc -l < /tmp/one.csv
```
Expected: the full CSV download has `Content-Disposition: attachment; filename="firmacheck-export.csv"`, the header row begins with `ico;obchodni_nazev;...`, the JSON request reports `application/json`, and the single-company export reports `filename="firmacheck-02823519.csv"` with exactly 2 lines (header + one row).

- [ ] **Step 3: Commit**

```bash
git add server/api/companies/export.get.ts
git commit -m "feat: add CSV/JSON export endpoint"
```

---

## Task 13: App shell + page state

**Files:**
- Modify: `app/app.vue`
- Create: `app/pages/index.vue`

- [ ] **Step 1: Set up the app shell**

Replace `app/app.vue` with:
```vue
<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </UApp>
</template>
```

- [ ] **Step 2: Create the page that owns state and orchestrates components**

Create `app/pages/index.vue`:
```vue
<script setup lang="ts">
import type { SavedCompany, VerifyResult } from '~~/shared/types'

const result = ref<VerifyResult | null>(null)
const verifying = ref(false)
const saved = ref<SavedCompany[]>([])

async function loadSaved() {
  saved.value = await $fetch<SavedCompany[]>('/api/companies')
}

async function onVerify(payload: { ico: string, name?: string }) {
  verifying.value = true
  try {
    result.value = await $fetch<VerifyResult>('/api/verify', { method: 'POST', body: payload })
  }
  catch {
    result.value = { status: 'error', company: null, aresSource: null, geo: null, geoSource: null, nameMatch: null, message: 'Chyba při komunikaci se serverem.' }
  }
  finally {
    verifying.value = false
  }
}

async function onSave(result: VerifyResult) {
  if (result.status !== 'found' || !result.company) return
  await $fetch('/api/companies', {
    method: 'POST',
    body: {
      ...result.company,
      lat: result.geo?.lat ?? null,
      lon: result.geo?.lon ?? null,
      lastSource: result.aresSource,
    },
  })
  await loadSaved()
}

async function onRemove(ico: string) {
  await $fetch(`/api/companies/${ico}`, { method: 'DELETE' })
  await loadSaved()
}

function onReopen(company: SavedCompany) {
  result.value = {
    status: 'found',
    company,
    aresSource: company.lastSource,
    geo: company.lat != null && company.lon != null ? { lat: company.lat, lon: company.lon } : null,
    geoSource: company.lat != null ? 'cache' : null,
    nameMatch: null,
  }
}

await loadSaved()
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-bold">
        FirmaCheck
      </h1>
      <p class="text-(--ui-text-muted)">
        Rychlé ověření české firmy podle IČO
      </p>
    </div>

    <VerifyForm :loading="verifying" @verify="onVerify" />

    <CompanyDetail
      v-if="result"
      :result="result"
      @save="onSave(result)"
    />

    <SavedCompanies
      :companies="saved"
      @reopen="onReopen"
      @remove="onRemove"
    />
  </UContainer>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add app/app.vue app/pages/index.vue
git commit -m "feat: add app shell and main page orchestration"
```

> Note: the page references `VerifyForm`, `CompanyDetail`, and `SavedCompanies`, built in Tasks 14-17. The dev server will show "component not found" warnings until those exist — that is expected between tasks.

---

## Task 14: VerifyForm component (Nuxt UI + Zod validation)

**Files:**
- Create: `app/components/VerifyForm.vue`

- [ ] **Step 1: Implement the form**

Create `app/components/VerifyForm.vue`:
```vue
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { verifySchema, type VerifyInput } from '~~/shared/schema'

defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ verify: [payload: { ico: string, name?: string }] }>()

const state = reactive<Partial<VerifyInput>>({ ico: '', name: '' })

function onSubmit(event: FormSubmitEvent<VerifyInput>) {
  emit('verify', { ico: event.data.ico, name: event.data.name || undefined })
}
</script>

<template>
  <UForm
    :schema="verifySchema"
    :state="state"
    class="space-y-4 max-w-md mx-auto"
    @submit="onSubmit"
  >
    <UFormField label="IČO" name="ico" required>
      <UInput v-model="state.ico" placeholder="02823519" class="w-full" />
    </UFormField>

    <UFormField label="Název firmy (volitelné)" name="name">
      <UInput v-model="state.name" placeholder="ideabox" class="w-full" />
    </UFormField>

    <UButton type="submit" :loading="loading" block>
      Ověřit firmu
    </UButton>
  </UForm>
</template>
```

- [ ] **Step 2: Verify validation in the browser**

Run `pnpm dev`, open `http://localhost:3000`, and:
- Submit empty → inline error "IČO musí mít přesně 8 číslic".
- Type `02823518` → inline error "Neplatné IČO (chybný kontrolní součet)".
- Type `02823519` and submit → no validation error (the detail section will populate once Task 15 is done; for now the network request fires).

Expected: Nuxt UI shows styled inline errors under the IČO field and blocks submission until valid.

- [ ] **Step 3: Commit**

```bash
git add app/components/VerifyForm.vue
git commit -m "feat: add VerifyForm with Zod-backed Nuxt UI validation"
```

---

## Task 15: CompanyDetail component

**Files:**
- Create: `app/components/CompanyDetail.vue`

- [ ] **Step 1: Implement the detail view**

Create `app/components/CompanyDetail.vue`:
```vue
<script setup lang="ts">
import type { VerifyResult } from '~~/shared/types'

const props = defineProps<{ result: VerifyResult }>()
defineEmits<{ save: [] }>()

const statusBadge = computed(() => {
  switch (props.result.status) {
    case 'found': return { color: 'success' as const, label: 'Firma nalezena' }
    case 'not_found': return { color: 'warning' as const, label: 'Firma nenalezena' }
    default: return { color: 'error' as const, label: 'Chyba při načítání dat' }
  }
})

const nameMatchText = computed(() => {
  switch (props.result.nameMatch) {
    case 'match': return { color: 'success' as const, text: 'Zadaný název odpovídá názvu v ARES.' }
    case 'partial': return { color: 'warning' as const, text: 'Zadaný název částečně odpovídá názvu v ARES.' }
    case 'mismatch': return { color: 'error' as const, text: 'Zadaný název se liší od názvu v ARES.' }
    default: return null
  }
})

const mapyLink = computed(() =>
  props.result.geo
    ? `https://mapy.cz/zakladni?q=${encodeURIComponent(props.result.company?.address ?? '')}`
    : null,
)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UBadge :color="statusBadge.color" variant="subtle">
          {{ statusBadge.label }}
        </UBadge>
        <div v-if="result.status === 'found'" class="flex gap-2">
          <UBadge variant="outline">
            ARES: {{ result.aresSource === 'api' ? 'API' : 'SQLite cache' }}
          </UBadge>
          <UBadge v-if="result.geoSource" variant="outline">
            Geocoding: {{ result.geoSource === 'api' ? 'API' : 'SQLite cache' }}
          </UBadge>
        </div>
      </div>
    </template>

    <div v-if="result.status !== 'found'" class="text-(--ui-text-muted)">
      {{ result.message }}
    </div>

    <div v-else-if="result.company" class="space-y-4">
      <UAlert
        v-if="nameMatchText"
        :color="nameMatchText.color"
        variant="subtle"
        :title="nameMatchText.text"
      />

      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt class="text-sm text-(--ui-text-muted)">IČO</dt>
          <dd class="font-medium">{{ result.company.ico }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Obchodní název</dt>
          <dd class="font-medium">{{ result.company.name }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Právní forma</dt>
          <dd class="font-medium">{{ result.company.legalForm }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Datum vzniku</dt>
          <dd class="font-medium">{{ result.company.foundedDate ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Stav subjektu</dt>
          <dd class="font-medium">{{ result.company.status }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">DIČ</dt>
          <dd class="font-medium">{{ result.company.dic ?? '—' }}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-sm text-(--ui-text-muted)">Adresa sídla</dt>
          <dd class="font-medium">{{ result.company.address }}</dd>
        </div>
      </dl>

      <div v-if="result.geo" class="space-y-2">
        <MapView :lat="result.geo.lat" :lon="result.geo.lon" :label="result.company.name" />
        <div class="flex items-center justify-between text-sm text-(--ui-text-muted)">
          <span>Souřadnice: {{ result.geo.lat.toFixed(5) }}, {{ result.geo.lon.toFixed(5) }}</span>
          <ULink v-if="mapyLink" :to="mapyLink" target="_blank">Otevřít v Mapy.cz</ULink>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton icon="i-lucide-bookmark" @click="$emit('save')">
          Uložit firmu
        </UButton>
      </div>
    </div>
  </UCard>
</template>
```

- [ ] **Step 2: Verify in the browser**

Run `pnpm dev`, verify `02823519`. The card shows the status badge, both source badges, all ARES fields, the name-match alert (enter name `ideabox` → green "odpovídá"), and an "Uložit firmu" button. The map area will be empty until Task 16 (MapView) exists.

- [ ] **Step 3: Commit**

```bash
git add app/components/CompanyDetail.vue
git commit -m "feat: add CompanyDetail with status/source badges and name match"
```

---

## Task 16: MapView component (Leaflet + Mapy.cz tiles)

**Files:**
- Create: `app/components/MapView.client.vue`

- [ ] **Step 1: Implement the client-only map**

Create `app/components/MapView.client.vue`:
```vue
<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

const props = defineProps<{ lat: number, lon: number, label?: string }>()
const el = ref<HTMLElement | null>(null)
const config = useRuntimeConfig()
let map: L.Map | null = null

const icon = L.icon({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function render() {
  if (!el.value) return
  const apiKey = config.public.mapyApiKey as string

  map = L.map(el.value).setView([props.lat, props.lon], 16)

  L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${apiKey}`, {
    minZoom: 0,
    maxZoom: 19,
    attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
  }).addTo(map)

  // Required Mapy.com logo control
  const LogoControl = L.Control.extend({
    options: { position: 'bottomleft' as const },
    onAdd() {
      const container = L.DomUtil.create('div')
      container.innerHTML = '<a href="https://mapy.com/" target="_blank"><img src="https://api.mapy.com/img/api/logo.svg" alt="Mapy.com" style="height:18px"></a>'
      L.DomEvent.disableClickPropagation(container)
      return container
    },
  })
  new LogoControl().addTo(map)

  L.marker([props.lat, props.lon], { icon }).addTo(map).bindPopup(props.label ?? '')
}

onMounted(render)

watch(() => [props.lat, props.lon], () => {
  if (map) {
    map.remove()
    map = null
  }
  render()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="el" class="h-72 w-full rounded-lg overflow-hidden border border-(--ui-border)" />
</template>
```

- [ ] **Step 2: Verify the map renders**

Run `pnpm dev` (with `NUXT_PUBLIC_MAPY_API_KEY` set in `.env`), verify `02823519`.
Expected: a Mapy.cz map renders inside the detail card with a marker on the company seat, the Mapy.com logo bottom-left, and attribution bottom-right. If the key is missing, the tiles are blank but the app does not crash.

- [ ] **Step 3: Commit**

```bash
git add app/components/MapView.client.vue
git commit -m "feat: add Leaflet map view with Mapy.cz tiles"
```

---

## Task 17: SavedCompanies component (list + export)

**Files:**
- Create: `app/components/SavedCompanies.vue`

- [ ] **Step 1: Implement the list, exports, and empty state**

Create `app/components/SavedCompanies.vue`:
```vue
<script setup lang="ts">
import type { SavedCompany } from '~~/shared/types'

const props = defineProps<{ companies: SavedCompany[] }>()
defineEmits<{ reopen: [company: SavedCompany], remove: [ico: string] }>()

const toast = useToast()

function download(format: 'csv' | 'json') {
  window.location.href = `/api/companies/export?format=${format}`
}

function downloadOne(ico: string, format: 'csv' | 'json') {
  window.location.href = `/api/companies/export?format=${format}&ico=${ico}`
}

async function copyJson() {
  await navigator.clipboard.writeText(JSON.stringify(props.companies, null, 2))
  toast.add({ title: 'JSON zkopírován do schránky', color: 'success' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ')
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">
          Uložené firmy
        </h2>
        <div v-if="companies.length" class="flex gap-2">
          <UButton size="sm" variant="outline" icon="i-lucide-download" @click="download('csv')">
            CSV
          </UButton>
          <UButton size="sm" variant="outline" icon="i-lucide-download" @click="download('json')">
            JSON
          </UButton>
          <UButton size="sm" variant="ghost" icon="i-lucide-copy" @click="copyJson">
            Kopírovat JSON
          </UButton>
        </div>
      </div>
    </template>

    <div v-if="!companies.length" class="text-center py-8 space-y-3">
      <img src="~/assets/img/empty-state.png" alt="Žádné uložené firmy" class="mx-auto h-40 w-auto opacity-90">
      <p class="text-(--ui-text-muted)">
        Zatím nemáte uložené žádné firmy. Ověřte firmu a uložte ji.
      </p>
    </div>

    <ul v-else class="divide-y divide-(--ui-border)">
      <li
        v-for="c in companies"
        :key="c.ico"
        class="flex items-center justify-between gap-4 py-3"
      >
        <button class="text-left flex-1 cursor-pointer" @click="$emit('reopen', c)">
          <p class="font-medium">{{ c.name }}</p>
          <p class="text-sm text-(--ui-text-muted)">
            IČO {{ c.ico }} · {{ c.address }}
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            Ověřeno: {{ formatDate(c.lastVerifiedAt) }}
          </p>
        </button>
        <div class="flex items-center gap-1">
          <UDropdownMenu
            :items="[
              { label: 'Export CSV', icon: 'i-lucide-download', onSelect: () => downloadOne(c.ico, 'csv') },
              { label: 'Export JSON', icon: 'i-lucide-download', onSelect: () => downloadOne(c.ico, 'json') },
            ]"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              aria-label="Export firmy"
            />
          </UDropdownMenu>
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            aria-label="Odebrat firmu"
            @click="$emit('remove', c.ico)"
          />
        </div>
      </li>
    </ul>
  </UCard>
</template>
```

- [ ] **Step 2: Verify the full UI flow**

Run `pnpm dev`. With no saved companies, the empty-state illustration shows (placeholder until Task 18 adds the image — if the asset is missing the build will error, so create a 1x1 placeholder now if needed: `mkdir -p app/assets/img && curl -s -o app/assets/img/empty-state.png https://placehold.co/400x300/png`). Verify a company, click "Uložit firmu" → it appears in the list. Click the row → detail reopens. Click trash → it disappears. Click the header CSV/JSON → full-list files download. Open a row's ⋮ menu → "Export CSV"/"Export JSON" download just that company. Click "Kopírovat JSON" → toast appears.

- [ ] **Step 3: Commit**

```bash
git add app/components/SavedCompanies.vue
git commit -m "feat: add SavedCompanies list with export and empty state"
```

---

## Task 18: AI-generated visual element

**Files:**
- Create: `app/assets/img/empty-state.png`

- [ ] **Step 1: Generate the illustration**

Use an AI image tool (e.g. ChatGPT/DALL·E, Midjourney, or Gemini) to generate an empty-state illustration. Suggested prompt (record the exact one used, for the README):
> "A friendly minimalist flat-illustration empty state for a Czech business-lookup app: a stylized magnifying glass over a document with a company building and a small map pin, soft modern palette of indigo and teal on a transparent background, clean vector style, no text."

Save the result as `app/assets/img/empty-state.png` (replacing any placeholder). Keep it under ~200 KB; optimize if needed.

- [ ] **Step 2: Verify it renders**

Run `pnpm dev`, clear the saved list (delete all), confirm the illustration shows in the empty state and looks correct.

- [ ] **Step 3: Commit**

```bash
git add app/assets/img/empty-state.png
git commit -m "feat: add AI-generated empty-state illustration"
```

---

## Task 19: Dockerfile + Coolify deployment config

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create the Dockerfile**

Create `Dockerfile`:
```dockerfile
# --- Build stage ---
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# --- Runtime stage (same base ⇒ better-sqlite3 native binary is compatible) ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NUXT_DB_PATH=/app/data/firmacheck.db
ENV NITRO_PORT=3000
COPY --from=builder /app/.output ./.output
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Create .dockerignore**

Create `.dockerignore`:
```
node_modules
.nuxt
.output
.data
data
.git
*.log
.env
.env.*
```

- [ ] **Step 3: Build and run the image locally**

Run:
```bash
docker build -t firmacheck .
docker run --rm -p 3000:3000 \
  -e NUXT_MAPY_API_KEY="$NUXT_MAPY_API_KEY" \
  -e NUXT_PUBLIC_MAPY_API_KEY="$NUXT_PUBLIC_MAPY_API_KEY" \
  -v firmacheck-data:/app/data \
  firmacheck
```
Then in another shell:
```bash
curl -s -X POST http://localhost:3000/api/verify -H 'Content-Type: application/json' -d '{"ico":"02823519"}' | head -c 200; echo
```
Expected: the container serves the app on port 3000 and `/api/verify` returns `"status":"found"`. The `firmacheck-data` named volume persists the DB across container restarts.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add Dockerfile and dockerignore for Coolify"
```

> **Coolify configuration (do at deploy time, document in README):**
> - Deploy from the GitHub repo using the Dockerfile build pack.
> - Add a **persistent volume** mapped to `/app/data` (critical — without it the SQLite DB resets on every redeploy).
> - Set env vars: `NUXT_MAPY_API_KEY`, `NUXT_PUBLIC_MAPY_API_KEY`, `NUXT_DB_PATH=/app/data/firmacheck.db`.
> - Expose port 3000 and attach the domain.

---

## Task 20: README documentation

**Files:**
- Modify: `README.md` (replace the Nuxt starter content)

- [ ] **Step 1: Write the README**

Replace `README.md` with a document covering every item the assignment's README section requires. Use real content, not placeholders:

```markdown
# FirmaCheck

Ověření základních údajů o české firmě podle IČO — data z rejstříku ARES, sídlo na mapě (Mapy.cz), SQLite cache, ukládání firem a export do CSV/JSON.

**Živé demo:** <DEPLOYED_URL>

## Co aplikace umí
- Ověření firmy podle IČO (s volitelnou kontrolou názvu) přes ARES API.
- Zobrazení stavu ověření a zdroje dat (ARES API / SQLite cache).
- Geocoding adresy sídla a zobrazení na mapě s markerem a souřadnicemi.
- Uložení ověřených firem do seznamu a jejich opětovné otevření.
- Export uložených firem do CSV a JSON, kopírování JSON do schránky.

## Tech stack
Nuxt 4 (Nitro), Vue 3, Nuxt UI, Zod, better-sqlite3, Leaflet + Mapy.cz dlaždice, Vitest. Nasazení přes Docker / Coolify.

## Použité API služby
- **ARES** (`ares.gov.cz`) — registr ekonomických subjektů, vyhledání podle IČO.
- **Mapy.cz / Mapy.com REST API** — geocoding adresy a mapové dlaždice.

## Lokální spuštění
1. `pnpm install`
2. Zkopírujte `.env.example` na `.env` a doplňte `NUXT_MAPY_API_KEY` a `NUXT_PUBLIC_MAPY_API_KEY` (klíč z https://developer.mapy.com).
3. `pnpm dev` → http://localhost:3000
4. Testy: `pnpm test`

## Architektura a rozhodnutí
- **Self-hosting místo Vercel/Netlify:** zadání v sekci o SQLite výslovně připouští *vlastní server*. Self-hosting (Coolify) dává perzistentní filesystem, takže používáme klasickou server-side SQLite (`better-sqlite3`) — nejjednodušší a nejpřímočařejší řešení. (Pro serverless bych použil Turso/libSQL nebo browser-side WASM SQLite.)
- **SQLite cache:** odpovědi z ARES se ukládají do tabulky `ares_cache` (klíč = IČO), výsledky geocodingu do `geocode_cache` (klíč = normalizovaná adresa). První dotaz jde na API a uloží se; opakovaný dotaz se obslouží z cache. Aplikace u každého výsledku zobrazuje, zda data pochází z API nebo z cache. Cache nemá TTL (perzistentní).
- **Ukládání firem:** stejný mechanismus jako cache — server-side SQLite (`saved_companies`). Jde o jeden globální seznam (bez přihlašování), což je pro demo v pořádku; per-user řešení by vyžadovalo autentizaci.
- **CSV/JSON export:** generováno server-side z reálných uložených řádků. CSV používá oddělovač `;` a UTF-8 BOM kvůli kompatibilitě s českým Excelem; obsahuje hlavičku a sloupce IČO, název, právní forma, stav, adresa, datum vzniku, datum ověření, zdroj a souřadnice. JSON export a "Kopírovat JSON" jako bonus.

## AI nástroje
- **Vývoj, návrh a dokumentace:** <NÁSTROJE — např. Claude Code / Cursor>.
- **Vizuální prvek:** ilustrace prázdného stavu seznamu (`app/assets/img/empty-state.png`) vygenerovaná nástrojem <NÁSTROJ>. Prompt: "<PŘESNÝ POUŽITÝ PROMPT>". Umístěna do prázdného stavu, aby aplikace působila přívětivě, když ještě nejsou uložené žádné firmy.

### Ukázky promptů (min. 3)
1. "<PROMPT 1 — např. návrh architektury / brainstorming>"
2. "<PROMPT 2 — např. implementace ARES mapování>"
3. "<PROMPT 3 — generování ilustrace prázdného stavu>"

## Iterace během vývoje (min. 2)
1. <ITERACE 1 — např. volba storage: zvážení browser-side WASM SQLite vs server-side; rozhodnutí pro self-hosting + better-sqlite3.>
2. <ITERACE 2 — např. mapování stavu subjektu z `seznamRegistraci`/`primarniZdroj` po prozkoumání reálné odpovědi ARES.>

## Co bych vylepšil s více času
- TTL / invalidace cache, fulltextové vyhledávání podle názvu, per-user seznamy s přihlášením, e2e testy (Playwright), lepší pokrytí právních forem z oficiálního číselníku ARES.

## Čas strávený
Přibližně <ČAS> hodin.
```

- [ ] **Step 2: Fill the placeholders**

Replace every `<...>` placeholder with the real value (deployed URL, AI tools used, the three actual prompts, the two real iterations, the AI image prompt, time spent). The pre-commit goal: no `<...>` tokens remain.

- [ ] **Step 3: Run the full test suite and a production build**

Run:
```bash
pnpm test
pnpm build
```
Expected: all Vitest tests pass; the Nuxt production build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: write FirmaCheck README per assignment requirements"
```

---

## Final verification checklist (assignment coverage)

Run through `docs/assignment.md` "Povinné technické požadavky" and confirm each:
- [ ] Public GitHub repo + live demo (Coolify) — URL in README.
- [ ] ARES integration — `/api/verify` (Task 10).
- [ ] Mapy.cz geocoding + map — `mapy.ts` + `MapView` (Tasks 8, 16).
- [ ] SQLite cache for API responses, visibly sourced — `db.ts` + source badges (Tasks 7, 10, 15).
- [ ] Saved companies section — (Tasks 11, 17).
- [ ] CSV export with header + real data — (Tasks 9, 12).
- [ ] Responsive UX/UI — Nuxt UI + responsive grid (Tasks 13-17).
- [ ] IČO validation — mod-11 checksum in Zod schema (Tasks 3, 5, 14).
- [ ] Error state for missing IČO / API failure — (Tasks 10, 15).
- [ ] At least one AI-generated visual — (Task 18).
- [ ] README documentation — (Task 20).
- [ ] Required output fields: IČO, name, legal form, founding date, status, address, DIČ — (Task 6, 15).
- [ ] Name match (match/partial/mismatch) — (Tasks 4, 15).
- [ ] Coordinates + "open in maps" link — (Task 15).
- [ ] Bonus: JSON export + copy-to-clipboard + empty-list handling + per-company export — (Tasks 12, 17).
