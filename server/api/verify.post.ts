import type { CompanyData, VerifyResult } from '../../shared/types'
import { verifySchema } from '../../shared/schema'
import { normalizeAddress } from '../../shared/ico'
import { matchName } from '../../shared/nameMatch'
import { AresNotFoundError, fetchAresCompany } from '../utils/ares'
import { geocode } from '../utils/mapy'
import { useDb } from '../utils/db'

export default defineEventHandler(async (event): Promise<VerifyResult> => {
  const { ico, name } = await readValidatedBody(event, body => verifySchema.parse(body))
  const db = useDb()
  const now = new Date().toISOString()

  // --- ARES (cache first) ---
  let company: CompanyData
  let aresSource: 'api' | 'cache'
  const cachedAres = db
    .prepare('SELECT payload FROM ares_cache WHERE ico = ?')
    .get(ico) as { payload: string } | undefined

  if (cachedAres) {
    company = JSON.parse(cachedAres.payload)
    aresSource = 'cache'
  }
  else {
    try {
      company = await fetchAresCompany(ico)
    }
    catch (error) {
      if (error instanceof AresNotFoundError) {
        return { status: 'not_found', company: null, aresSource: null, geo: null, geoSource: null, nameMatch: null, message: error.message }
      }
      return { status: 'error', company: null, aresSource: null, geo: null, geoSource: null, nameMatch: null, message: 'Chyba při načítání dat z ARES.' }
    }
    db.prepare('INSERT OR REPLACE INTO ares_cache (ico, payload, fetched_at) VALUES (?, ?, ?)')
      .run(ico, JSON.stringify(company), now)
    aresSource = 'api'
  }

  // --- Geocoding (cache first) ---
  let geo: { lat: number, lon: number } | null = null
  let geoSource: 'api' | 'cache' | null = null
  if (company.address) {
    const key = normalizeAddress(company.address)
    const cachedGeo = db
      .prepare('SELECT lat, lon FROM geocode_cache WHERE address_norm = ?')
      .get(key) as { lat: number, lon: number } | undefined

    if (cachedGeo) {
      geo = { lat: cachedGeo.lat, lon: cachedGeo.lon }
      geoSource = 'cache'
    }
    else {
      const result = await geocode(company.address)
      if (result) {
        db.prepare('INSERT OR REPLACE INTO geocode_cache (address_norm, lat, lon, fetched_at) VALUES (?, ?, ?, ?)')
          .run(key, result.lat, result.lon, now)
        geo = result
        geoSource = 'api'
      }
    }
  }

  // --- Name match ---
  const nameMatch = name ? matchName(name, company.name) : null

  return { status: 'found', company, aresSource, geo, geoSource, nameMatch }
})
