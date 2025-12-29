import NpoListPage from '@/pages/npo/list-npo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/')({
  component: NpoListPage,
})
