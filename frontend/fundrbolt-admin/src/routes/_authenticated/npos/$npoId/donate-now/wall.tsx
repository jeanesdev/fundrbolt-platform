import { SupportWallModerationTable } from '@/components/donate-now/SupportWallModerationTable'
import { createFileRoute, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/wall')({
  component: DonateNowWallPage,
})

function DonateNowWallPage() {
  const { npoId } = useParams({ from: '/_authenticated/npos/$npoId/donate-now/wall' })

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-2xl font-bold'>Support Wall</h1>
        <p className='text-muted-foreground text-sm'>
          Moderate donor messages shown on the public support wall
        </p>
      </div>
      <SupportWallModerationTable npoId={npoId} />
    </div>
  )
}
