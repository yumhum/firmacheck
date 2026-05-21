import type { SavedCompany } from '../../../shared/types'
import { useDb } from '../../utils/db'

export default defineEventHandler((): SavedCompany[] => {
  const rows = useDb()
    .prepare('SELECT * FROM saved_companies ORDER BY saved_at DESC')
    .all() as Array<Record<string, unknown>>

  return rows.map(r => ({
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
})
