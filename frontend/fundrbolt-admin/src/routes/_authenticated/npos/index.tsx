import { createFileRoute } from '@tanstack/react-router'
import NpoListPage from '@/pages/npo/list-npo'

export const Route = createFileRoute('/_authenticated/npos/')({
  component: NpoListPage,
})
