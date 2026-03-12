import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPolicyPage } from '@/pages/legal'

export const Route = createFileRoute('/(auth)/privacy-policy')({
  component: PrivacyPolicyPage,
})
