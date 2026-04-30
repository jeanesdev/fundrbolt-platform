import { createFileRoute } from '@tanstack/react-router'
import { TermsOfServicePage } from '@/pages/legal'

export const Route = createFileRoute('/(auth)/terms-of-service')({
  component: TermsOfServicePage,
})
