import { createFileRoute } from '@tanstack/react-router'
import AcceptInvitationPage from '@/pages/invitations/accept-invitation'

export const Route = createFileRoute('/invitations/accept')({
  component: AcceptInvitationPage,
})
