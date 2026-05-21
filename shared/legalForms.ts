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
