import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (name[0] || '?').toUpperCase()
}

interface BidderAvatarProps {
  name: string
  imageUrl?: string | null
  className?: string
}

export function BidderAvatar({ name, imageUrl, className }: BidderAvatarProps) {
  return (
    <Avatar className={cn('size-7', className)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
      <AvatarFallback className='text-xs'>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}
