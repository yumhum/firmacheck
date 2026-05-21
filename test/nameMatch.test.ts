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
