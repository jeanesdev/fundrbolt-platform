import { TermsOfServicePage } from '@/pages/legal'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)/terms-of-service')({
  component: TermsOfServicePage,
})
