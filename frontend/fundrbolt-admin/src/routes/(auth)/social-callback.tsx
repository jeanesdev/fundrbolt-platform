import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SocialCallback } from '@/features/auth/social-callback'

const searchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/social-callback')({
  component: SocialCallback,
  validateSearch: searchSchema,
})
