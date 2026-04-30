import { createFileRoute } from '@tanstack/react-router'
import NpoDetailPage from '@/pages/npo/detail-npo'

export const Route = createFileRoute('/_authenticated/npos/$npoId/')({
  component: NpoDetailPage,
})
