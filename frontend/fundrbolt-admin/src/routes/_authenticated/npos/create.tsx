import CreateNPOPage from '@/pages/npo/create-npo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/create')({
  component: CreateNPOPage,
})
