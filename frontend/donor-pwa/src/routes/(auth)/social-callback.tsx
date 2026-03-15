import { SocialCallback } from '@/features/auth/social-callback'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z
  .object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough()

export const Route = createFileRoute('/(auth)/social-callback')({
  component: SocialCallback,
  validateSearch: searchSchema,
})
