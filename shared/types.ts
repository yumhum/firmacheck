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
