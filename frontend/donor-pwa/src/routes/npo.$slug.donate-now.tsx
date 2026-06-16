import { DonateNowPage } from '@/features/donate-now/DonateNowPage'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const donateNowSearchSchema = z.object({
  donateResume: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .optional(),
  amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined
      }

      const parsed =
        typeof value === 'number' ? value : Number.parseFloat(value)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
    }),
})

export const Route = createFileRoute('/npo/$slug/donate-now')({
  component: DonateNowPage,
  validateSearch: donateNowSearchSchema,
})
