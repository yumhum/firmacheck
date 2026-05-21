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
