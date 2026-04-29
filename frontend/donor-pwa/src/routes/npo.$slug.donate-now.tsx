import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { DonateNowPage } from '@/features/donate-now/DonateNowPage'

const donateNowSearchSchema = z.object({
  donateResume: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .optional(),
})

export const Route = createFileRoute('/npo/$slug/donate-now')({
  component: DonateNowPage,
  validateSearch: donateNowSearchSchema,
})
