/**
 * InitialAvatar Component
 * Displays a circular avatar with initials and branding colors
 *
 * Used as fallback when NPO/Event logos are not uploaded.
 * Ensures WCAG AA compliance with auto-contrasting text colors.
 */

import { cn } from '@/lib/utils'
import { useInitialAvatar, type UseInitialAvatarProps } from '@/hooks/use-initial-avatar'

export interface InitialAvatarProps extends UseInitialAvatarProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function InitialAvatar({
  name,
  brandingPrimaryColor,
  size = 'md',
  className,
}: InitialAvatarProps) {
  const { initials, bgColor, textColor, hasBorder } = useInitialAvatar({
    name,
    brandingPrimaryColor,
  })

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold',
        sizeClasses[size],
        hasBorder && 'border-2 border-border',
        className
      )}
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
      aria-label={`${name} avatar`}
    >
      {initials}
    </div>
  )
}
