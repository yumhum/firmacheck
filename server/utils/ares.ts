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
