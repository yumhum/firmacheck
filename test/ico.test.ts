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
