import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/tiers')({
  component: DonateNowTiersTab,
})

function DonateNowTiersTab() {
  return <div>Donation Tiers — Coming Soon</div>
}
