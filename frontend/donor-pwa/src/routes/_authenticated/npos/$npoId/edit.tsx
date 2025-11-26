import EditNPOPage from '@/pages/npo/edit-npo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/edit')({
  component: EditNPOPage,
})
