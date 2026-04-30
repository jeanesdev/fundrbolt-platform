import { createFileRoute } from '@tanstack/react-router'
import CreateNPOPage from '@/pages/npo/create-npo'

export const Route = createFileRoute('/_authenticated/npos/create')({
  component: CreateNPOPage,
})
