import { UserDetailPage } from '@/features/users'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/users/$userId/')({
  component: UserDetailPage,
})
