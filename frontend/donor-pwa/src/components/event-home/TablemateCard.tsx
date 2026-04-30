/**
 * TablemateCard Component (T079)
 *
 * Display card for a single tablemate showing:
 * - Name
 * - Bidder number (if checked in)
 * - Company (optional)
 * - Profile image (optional)
 */
import { Hash, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface TablemateCardProps {
  name: string | null
  bidderNumber: number | null
  company?: string | null
  profileImageUrl?: string | null
}

export function TablemateCard({
  name,
  bidderNumber,
  company,
  profileImageUrl,
}: TablemateCardProps) {
  // Extract initials from name for avatar fallback
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <Card
      className='border transition-shadow hover:shadow-md'
      style={{
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
        color: 'var(--event-text-on-background, #000000)',
      }}
    >
      <CardContent className='p-2'>
        <div className='flex items-center gap-2'>
          {/* Avatar */}
          <Avatar className='h-8 w-8'>
            {profileImageUrl && (
              <AvatarImage src={profileImageUrl} alt={name || 'Guest'} />
            )}
            <AvatarFallback
              className='border'
              style={{
                backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.45)',
                color: 'rgb(var(--event-primary, 59, 130, 246))',
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Guest Info */}
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-1.5'>
              <p className='truncate text-sm font-medium'>{name || 'Guest'}</p>
              {bidderNumber && (
                <Badge
                  variant='outline'
                  className='flex shrink-0 items-center gap-1 px-1.5 py-0 text-[11px]'
                  style={{
                    borderColor:
                      'rgb(var(--event-primary, 59, 130, 246) / 0.45)',
                    color: 'rgb(var(--event-primary, 59, 130, 246))',
                  }}
                >
                  <Hash className='h-3 w-3' />
                  {bidderNumber}
                </Badge>
              )}
            </div>
            {company && (
              <p
                className='truncate text-xs'
                style={{
                  color: 'var(--event-text-muted-on-background, #6B7280)',
                }}
              >
                {company}
              </p>
            )}
            {!bidderNumber && (
              <p
                className='text-xs italic'
                style={{
                  color: 'var(--event-text-muted-on-background, #6B7280)',
                }}
              >
                Not checked in
              </p>
            )}
          </div>

          {/* User icon for visual consistency */}
          <User
            className='h-4 w-4 shrink-0'
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
