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
