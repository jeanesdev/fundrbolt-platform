import { DonateNowPage } from '@/features/donate-now/DonateNowPage'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

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
