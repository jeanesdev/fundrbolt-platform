import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { Users } from '@/features/users'
import { roles } from '@/features/users/data/data'

const usersSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  name: z.string().optional(),
  // Facet filters
  status: z
    .array(z.union([z.literal('active'), z.literal('inactive')]))
    .optional()
    .catch([]),
  role: z
    .array(z.enum(roles.map((r) => r.value as (typeof roles)[number]['value'])))
    .optional()
    .catch([]),
})

// Roles allowed to access user management (admin roles only)
const ALLOWED_ROLES = ['super_admin', 'npo_admin']

export const Route = createFileRoute('/_authenticated/users/')({
  validateSearch: usersSearchSchema,
  beforeLoad: () => {
    const user = useAuthStore.getState().user

    // Check if user is authenticated
    if (!user) {
      throw redirect({
        to: '/sign-in',
      })
    }

    // Check if user has required role (super_admin or npo_admin)
    if (!ALLOWED_ROLES.includes(user.role)) {
      // Redirect to home with error
      throw redirect({
        to: '/',
      })
    }
  },
  component: Users,
})
