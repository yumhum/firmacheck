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

  it('escapes double quotes by doubling them', () => {
    const q = buildCsv([{ ...rows[0]!, name: 'He said "hi"' }])
    expect(q).toContain('"He said ""hi"""')
  })

  it('leaves coordinates empty when lat/lon are null', () => {
    const noGeo = buildCsv([{ ...rows[0]!, lat: null, lon: null }])
    const dataLine = noGeo.replace(/^﻿/, '').split('\n')[1]!
    expect(dataLine.endsWith(';')).toBe(true) // souradnice column is empty
  })

  it('renders an empty datum_vzniku when foundedDate is null', () => {
    const noDate = buildCsv([{ ...rows[0]!, foundedDate: null }])
    expect(noDate).toContain('Aktivní') // sanity: row still present
    const dataLine = noDate.replace(/^﻿/, '').split('\n')[1]!
    // datum_vzniku is the 6th column (index 5) — should be empty between two semicolons
    expect(dataLine.split(';')[5]).toBe('')
  })
})

describe('toJson', () => {
  it('produces pretty-printed JSON of the rows', () => {
    expect(JSON.parse(toJson(rows))).toEqual(rows)
  })
})
