import { DonateNowPage } from '@/features/donate-now/DonateNowPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/npo/$slug/donate-now')({
  component: DonateNowPage,
})
