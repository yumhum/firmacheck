import type { SavedCompany } from '../../../shared/types'
import { buildCsv, toJson } from '../../utils/csv'
import { useDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const format = (query.format as string) === 'json' ? 'json' : 'csv'
  // Optional ?ico= filter exports a single selected company (bonus).
  const ico = typeof query.ico === 'string' && /^\d{8}$/.test(query.ico) ? query.ico : null

  const rows = (ico
    ? useDb().prepare('SELECT * FROM saved_companies WHERE ico = ?').all(ico)
    : useDb().prepare('SELECT * FROM saved_companies ORDER BY saved_at DESC').all()
  ) as Array<Record<string, unknown>>

  const companies: SavedCompany[] = rows.map(r => ({
    ico: r.ico as string,
    name: r.name as string,
    legalForm: r.legal_form as string,
    legalFormCode: r.legal_form_code as string,
    status: r.status as string,
    address: r.address as string,
    foundedDate: (r.founded_date as string) ?? null,
    dic: (r.dic as string) ?? null,
    lat: (r.lat as number) ?? null,
    lon: (r.lon as number) ?? null,
    lastSource: r.last_source as 'api' | 'cache',
    savedAt: r.saved_at as string,
    lastVerifiedAt: r.last_verified_at as string,
  }))

  const base = ico ? `firmacheck-${ico}` : 'firmacheck-export'

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="${base}.json"`)
    return toJson(companies)
  }

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${base}.csv"`)
  return buildCsv(companies)
})
