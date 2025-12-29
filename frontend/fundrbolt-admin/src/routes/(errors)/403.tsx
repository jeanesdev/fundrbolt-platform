import { createFileRoute } from '@tanstack/react-router'
import { UnauthorizedPage } from '@/pages/errors/UnauthorizedPage'

export const Route = createFileRoute('/(errors)/403')({
  component: UnauthorizedPage,
})
