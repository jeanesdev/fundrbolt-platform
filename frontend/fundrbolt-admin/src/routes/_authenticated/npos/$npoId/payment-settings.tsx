import NpoPaymentSettingsPage from '@/pages/npo/payment-settings-npo'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/payment-settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return <NpoPaymentSettingsPage />
}
