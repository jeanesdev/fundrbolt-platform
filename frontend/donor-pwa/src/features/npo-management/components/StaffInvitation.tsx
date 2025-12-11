/**
 * StaffInvitation Component
 * Form for inviting new members to NPO and displaying pending invitations
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getErrorMessage } from '@/lib/error-utils'
import { memberApi } from '@/services/npo-service'
import type { MemberRole } from '@/types/npo'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Send, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface StaffInvitationProps {
  npoId: string
}

// Role options for selection
const roleOptions: { value: MemberRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full control' },
  { value: 'co_admin', label: 'Co-Admin', description: 'Manage members and settings' },
  { value: 'staff', label: 'Staff', description: 'Basic access' },
]

export function StaffInvitation({ npoId }: StaffInvitationProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<MemberRole>('staff')

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: () => {
      // eslint-disable-next-line no-console
      console.log('🚀 Sending invitation:', { npoId, email, firstName, lastName, role })
      return memberApi.inviteMember(npoId, {
        email,
        role,
        first_name: firstName || undefined,
        last_name: lastName || undefined
      })
    },
    onSuccess: (data) => {
      // eslint-disable-next-line no-console
      console.log('✅ Invitation sent successfully:', data)
      queryClient.invalidateQueries({ queryKey: ['npo-members', npoId] })
      queryClient.invalidateQueries({ queryKey: ['npo-invitations', npoId] })
      toast.success(`Invitation sent to ${email}`)
      toast.info(`Invitation expires: ${new Date(data.expires_at).toLocaleString()}`)
      setEmail('')
      setRole('staff')
      setFirstName('')
      setLastName('')
    },
    onError: (error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('❌ Invitation failed:', error)
      // eslint-disable-next-line no-console
      console.error('Error response:', error)

      const message = getErrorMessage(error, 'Failed to send invitation')
      toast.error(message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    if (!email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    inviteMutation.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Team Member
        </CardTitle>
        <CardDescription>
          Send an invitation email to add a new member to your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first-name">First Name (Optional)</Label>
              <Input
                id="first-name"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={inviteMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Pre-fill registration form
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="last-name">Last Name (Optional)</Label>
              <Input
                id="last-name"
                type="text"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={inviteMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Pre-fill registration form
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={inviteMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as MemberRole)}
                disabled={inviteMutation.isPending}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="submit"
              disabled={inviteMutation.isPending}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
            {inviteMutation.isPending && (
              <div className="text-sm text-muted-foreground">
                Processing invitation...
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> The invited user will receive an email with a secure
              link to accept the invitation. The invitation will expire in 7 days.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
