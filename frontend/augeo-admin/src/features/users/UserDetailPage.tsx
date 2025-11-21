import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from 'lucide-react'
import { useUser } from './hooks/use-users'

export function UserDetailPage() {
  const { userId } = useParams({ from: '/_authenticated/users/$userId/' })
  const { data: user, isLoading, isError } = useUser(userId)

  if (isLoading) {
    return (
      <div className='flex flex-1 items-center justify-center'>
        <div className='text-muted-foreground'>Loading user...</div>
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-4'>
        <div className='text-muted-foreground'>Failed to load user</div>
        <Button asChild variant='outline'>
          <Link to='/users'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Users
          </Link>
        </Button>
      </div>
    )
  }

  const fullName = `${user.first_name} ${user.last_name}`
  const hasAddress =
    user.address_line1 || user.city || user.state || user.postal_code
  const hasSocialMedia = user.social_media_links && Object.keys(user.social_media_links).length > 0

  const socialIcons: Record<string, typeof Facebook> = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
    website: Globe,
  }

  return (
    <div className='flex flex-1 flex-col gap-6 px-2 py-3 sm:px-6 sm:py-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/users'>
            <ArrowLeft className='h-4 w-4' />
          </Link>
        </Button>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>User Profile</h2>
          <p className='text-muted-foreground'>View user information and activity</p>
        </div>
      </div>

      <div className='grid gap-6 md:grid-cols-3'>
        {/* Left Column - Profile Card */}
        <Card className='md:col-span-1'>
          <CardHeader className='text-center'>
            {/* Profile Picture */}
            <div className='mx-auto mb-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-muted'>
              {user.profile_picture_url ? (
                <img
                  src={user.profile_picture_url}
                  alt={fullName}
                  className='h-full w-full object-cover'
                />
              ) : (
                <div className='flex h-full w-full items-center justify-center bg-primary/10 text-4xl font-semibold text-primary'>
                  {user.first_name[0]}
                  {user.last_name[0]}
                </div>
              )}
            </div>
            <CardTitle className='text-xl'>{fullName}</CardTitle>
            {user.organization_name && (
              <p className='text-muted-foreground text-sm'>{user.organization_name}</p>
            )}
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Status Badges */}
            <div className='flex flex-wrap gap-2 justify-center'>
              <Badge
                variant='outline'
                className={cn(
                  user.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                )}
              >
                {user.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge
                variant='outline'
                className={cn(
                  user.email_verified
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                )}
              >
                {user.email_verified ? 'Email Verified' : 'Email Unverified'}
              </Badge>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className='space-y-3'>
              <div className='flex items-start gap-3'>
                <Mail className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
                <div className='min-w-0 flex-1'>
                  <p className='text-muted-foreground text-xs'>Email</p>
                  <a
                    href={`mailto:${user.email}`}
                    className='text-sm break-all hover:underline'
                  >
                    {user.email}
                  </a>
                </div>
              </div>

              {user.phone && (
                <div className='flex items-start gap-3'>
                  <Phone className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
                  <div className='min-w-0 flex-1'>
                    <p className='text-muted-foreground text-xs'>Phone</p>
                    <a
                      href={`tel:${user.phone}`}
                      className='text-sm hover:underline'
                    >
                      {user.phone}
                    </a>
                  </div>
                </div>
              )}

              {hasAddress && (
                <div className='flex items-start gap-3'>
                  <MapPin className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
                  <div className='min-w-0 flex-1'>
                    <p className='text-muted-foreground text-xs'>Address</p>
                    <div className='text-sm'>
                      {user.address_line1 && <p>{user.address_line1}</p>}
                      {user.address_line2 && <p>{user.address_line2}</p>}
                      {(user.city || user.state || user.postal_code) && (
                        <p>
                          {user.city && `${user.city}, `}
                          {user.state} {user.postal_code}
                        </p>
                      )}
                      {user.country && <p>{user.country}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Social Media Links */}
            {hasSocialMedia && (
              <>
                <Separator />
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-xs font-medium'>Social Media</p>
                  <div className='flex flex-wrap gap-2'>
                    {Object.entries(user.social_media_links!).map(([platform, url]) => {
                      if (!url) return null
                      const Icon = socialIcons[platform] || Globe
                      return (
                        <Button
                          key={platform}
                          asChild
                          variant='outline'
                          size='sm'
                          className='gap-2'
                        >
                          <a
                            href={url}
                            target='_blank'
                            rel='noopener noreferrer'
                          >
                            <Icon className='h-4 w-4' />
                            <span className='capitalize'>{platform}</span>
                          </a>
                        </Button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Details */}
        <div className='space-y-6 md:col-span-2'>
          {/* Role & Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Role & Permissions</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <p className='text-muted-foreground text-sm'>System Role</p>
                <Badge variant='secondary' className='mt-1 capitalize'>
                  {user.role.replace(/_/g, ' ')}
                </Badge>
              </div>

              {user.npo_memberships && user.npo_memberships.length > 0 && (
                <div>
                  <p className='text-muted-foreground mb-2 text-sm'>NPO Memberships</p>
                  <div className='space-y-2'>
                    {user.npo_memberships.map((membership) => (
                      <div
                        key={membership.npo_id}
                        className='flex items-center justify-between rounded-lg border p-3'
                      >
                        <div className='flex items-center gap-3'>
                          <Building2 className='text-muted-foreground h-5 w-5' />
                          <div>
                            <p className='font-medium'>{membership.npo_name}</p>
                            <p className='text-muted-foreground text-xs capitalize'>
                              {membership.role}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            membership.status === 'active' ? 'default' : 'secondary'
                          }
                          className='capitalize'
                        >
                          {membership.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Account Activity</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground text-sm'>Last Login</span>
                <span className='text-sm'>
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString()
                    : 'Never'}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground text-sm'>Account Created</span>
                <span className='text-sm'>
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground text-sm'>Last Updated</span>
                <span className='text-sm'>
                  {new Date(user.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default UserDetailPage
