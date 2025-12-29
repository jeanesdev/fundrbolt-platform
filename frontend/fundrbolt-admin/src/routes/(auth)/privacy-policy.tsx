import { PrivacyPolicyPage } from '@/pages/legal'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)/privacy-policy')({
  component: PrivacyPolicyPage,
})
