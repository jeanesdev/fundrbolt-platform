import { createFileRoute } from '@tanstack/react-router'
import EditNPOPage from '@/pages/npo/edit-npo'

export const Route = createFileRoute('/_authenticated/npos/$npoId/edit')({
  component: EditNPOPage,
})
