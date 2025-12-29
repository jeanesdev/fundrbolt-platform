import { z } from 'zod'

const _userStatusSchema = z.union([z.literal('active'), z.literal('inactive')])
export type UserStatus = z.infer<typeof _userStatusSchema>

const _userRoleSchema = z.union([
  z.literal('super_admin'),
  z.literal('npo_admin'),
  z.literal('event_coordinator'),
  z.literal('staff'),
  z.literal('donor'),
])
export type UserRole = z.infer<typeof _userRoleSchema>

const npoMembershipSchema = z.object({
  npo_id: z.string(),
  npo_name: z.string(),
  role: z.string(), // admin, co_admin, staff
  status: z.string(), // active, invited, suspended, removed
})
export type NPOMembership = z.infer<typeof npoMembershipSchema>

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  organization_name: z.string().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  profile_picture_url: z.string().nullable(),
  social_media_links: z.record(z.string(), z.string()).nullable(),
  role: z.string(), // String role name from backend
  npo_id: z.string().nullable(),
  npo_memberships: z.array(npoMembershipSchema).default([]),
  email_verified: z.boolean(),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type User = z.infer<typeof userSchema>

export const userListSchema = z.array(userSchema)
