import { z } from 'zod'
import { isValidIco } from './ico'

export const verifySchema = z.object({
  ico: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'IČO musí mít přesně 8 číslic')
    .refine(isValidIco, 'Neplatné IČO (chybný kontrolní součet)'),
  name: z.string().trim().max(200, 'Název je příliš dlouhý').optional(),
})

export type VerifyInput = z.infer<typeof verifySchema>
