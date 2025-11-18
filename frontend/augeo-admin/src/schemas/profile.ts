/**
 * Profile Update Validation Schema
 * Zod schema for validating user profile updates
 *
 * Fields match the User model:
 * - first_name, last_name (required)
 * - phone (optional, E.164 format)
 * - organization_name (optional)
 * - address_line1, address_line2 (optional)
 * - city, state, postal_code, country (optional)
 *
 * Email is NOT editable via profile form (requires separate verification flow)
 */

import { z } from 'zod'

// E.164 phone format regex: +[country code][number]
// Examples: +14155552671, +442071838750, +16175551212
const phoneRegex = /^\+[1-9]\d{1,14}$/

export const profileUpdateSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or less')
    .trim(),

  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or less')
    .trim(),

  phone: z
    .string()
    .regex(phoneRegex, 'Phone must be in E.164 format (e.g., +14155552671)')
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  organization_name: z
    .string()
    .max(255, 'Organization name must be 255 characters or less')
    .trim()
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  address_line1: z
    .string()
    .max(255, 'Address line 1 must be 255 characters or less')
    .trim()
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  address_line2: z
    .string()
    .max(255, 'Address line 2 must be 255 characters or less')
    .trim()
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  city: z
    .string()
    .max(100, 'City must be 100 characters or less')
    .trim()
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  state: z
    .string()
    .max(100, 'State must be 100 characters or less')
    .trim()
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  postal_code: z
    .string()
    .max(20, 'Postal code must be 20 characters or less')
    .trim()
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),

  country: z
    .string()
    .max(100, 'Country must be 100 characters or less')
    .trim()
    .optional()
    .or(z.literal(''))
    .transform(val => val === '' ? undefined : val),
})

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>

// Server response type (after successful update)
export interface ProfileUpdateResponse {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  organization_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  updated_at: string
}
