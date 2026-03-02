import AcceptInvitationPage from '@/pages/invitations/accept-invitation'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/invitations/accept')({
  component: AcceptInvitationPage,
})
