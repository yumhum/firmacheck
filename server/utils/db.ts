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
