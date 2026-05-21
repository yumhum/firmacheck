import { useDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const ico = getRouterParam(event, 'ico')
  if (!ico || !/^\d{8}$/.test(ico)) {
    throw createError({ statusCode: 400, message: 'Neplatné IČO' })
  }
  useDb().prepare('DELETE FROM saved_companies WHERE ico = ?').run(ico)
  return { ok: true }
})
