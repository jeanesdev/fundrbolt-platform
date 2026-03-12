import { createFileRoute } from '@tanstack/react-router'
import { NpoOnboardingWizard } from '@/features/npo-onboarding'

export const Route = createFileRoute('/(auth)/register-npo/')({
  component: NpoOnboardingWizard,
})
