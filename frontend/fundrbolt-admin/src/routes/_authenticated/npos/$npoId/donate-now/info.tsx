import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/info')({
  component: DonateNowInfoTab,
})

function DonateNowInfoTab() {
  return <div>NPO Info — Coming Soon</div>
}
