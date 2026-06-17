import type { ReactNode } from 'react'
import type { PublicCauseSectionCard } from '@/lib/api/cause-section-cards'
import { cn } from '@/lib/utils'
import { getCauseCardClasses } from './cardStyles'

interface CauseSectionShellProps {
  card: PublicCauseSectionCard
  children: ReactNode
  className?: string
}

export function CauseSectionShell({
  card,
  children,
  className,
}: CauseSectionShellProps) {
  const title =
    card.title || (card.built_in_section_key ?? '').replace(/_/g, ' ')

  const headerClassName = 'mb-3 text-sm font-semibold tracking-wide uppercase'
  const headerStyle = {
    color: 'rgb(var(--event-primary, 59, 130, 246))',
  }

  if (card.is_collapsible) {
    return (
      <details className={cn(getCauseCardClasses(card), className)} open>
        <summary
          className={cn(
            headerClassName,
            'focus-visible:ring-ring cursor-pointer list-none focus-visible:ring-2 focus-visible:outline-none'
          )}
          style={headerStyle}
        >
          {card.show_header ? title || 'Section' : 'Open section'}
        </summary>
        <div className={cn(card.show_header && 'mt-4')}>{children}</div>
      </details>
    )
  }

  return (
    <section className={cn(getCauseCardClasses(card), className)}>
      {card.show_header && !!title && (
        <h3 className={headerClassName} style={headerStyle}>
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}
