import NpoDetailPage from '@/pages/npo/detail-npo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/')({
  component: NpoDetailPage,
})
