import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/wall')({
  component: DonateNowWallTab,
})

function DonateNowWallTab() {
  return <div>Support Wall Moderation — Coming Soon</div>
}
