import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (name[0] || '?').toUpperCase()
}

interface BidderAvatarProps {
  name: string
  className?: string
}

export function BidderAvatar({ name, className }: BidderAvatarProps) {
  return (
    <Avatar className={cn('size-7', className)}>
      <AvatarFallback className='text-xs'>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
