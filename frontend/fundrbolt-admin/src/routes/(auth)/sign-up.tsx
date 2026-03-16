import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@/features/auth/sign-up'

const searchSchema = z.object({
  intent: z.enum(['npo', 'staff', 'donor']).optional(),
})

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUp,
  validateSearch: searchSchema,
})
