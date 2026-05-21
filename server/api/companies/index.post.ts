import { z } from 'zod'
import type { SavedCompany } from '../../../shared/types'
import { useDb } from '../../utils/db'

const saveSchema = z.object({
  ico: z.string().regex(/^\d{8}$/),
  name: z.string(),
  legalForm: z.string(),
  legalFormCode: z.string(),
  status: z.string(),
  address: z.string(),
  foundedDate: z.string().nullable(),
  dic: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  lastSource: z.enum(['api', 'cache']),
})

export default defineEventHandler(async (event): Promise<SavedCompany> => {
  const body = await readValidatedBody(event, data => saveSchema.parse(data))
  const now = new Date().toISOString()

  // Preserve original saved_at on re-save; always refresh last_verified_at.
  const existing = useDb()
    .prepare('SELECT saved_at FROM saved_companies WHERE ico = ?')
    .get(body.ico) as { saved_at: string } | undefined
  const savedAt = existing?.saved_at ?? now

  useDb().prepare(`
    INSERT OR REPLACE INTO saved_companies
      (ico, name, legal_form, legal_form_code, status, address, founded_date, dic,
       last_source, lat, lon, saved_at, last_verified_at)
    VALUES (@ico, @name, @legalForm, @legalFormCode, @status, @address, @foundedDate, @dic,
       @lastSource, @lat, @lon, @savedAt, @lastVerifiedAt)
  `).run({ ...body, savedAt, lastVerifiedAt: now })

  return { ...body, savedAt, lastVerifiedAt: now }
})
