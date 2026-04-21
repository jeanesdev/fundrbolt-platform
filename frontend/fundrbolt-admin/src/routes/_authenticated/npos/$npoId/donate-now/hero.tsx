import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/hero')({
  component: DonateNowHeroTab,
})

function DonateNowHeroTab() {
  return <div>Hero Configuration — Coming Soon</div>
}
