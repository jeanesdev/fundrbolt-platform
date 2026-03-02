import { Shield, UserCheck, Users, CreditCard } from 'lucide-react'
import { type UserStatus } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
])

export const roles = [
  {
    label: 'Super Admin',
    value: 'super_admin',
    icon: Shield,
  },
  {
    label: 'NPO Admin',
    value: 'npo_admin',
    icon: UserCheck,
  },
  {
    label: 'Event Coordinator',
    value: 'event_coordinator',
    icon: Users,
  },
  {
    label: 'Staff',
    value: 'staff',
    icon: UserCheck,
  },
  {
    label: 'Donor',
    value: 'donor',
    icon: CreditCard,
  },
] as const
