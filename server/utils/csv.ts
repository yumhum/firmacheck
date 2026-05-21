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
