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

  if (card.is_collapsible) {
    return (
      <details className={cn(getCauseCardClasses(card), className)} open>
        <summary className='cursor-pointer list-none text-sm font-semibold tracking-wide uppercase'>
          {card.show_header ? (title || 'Section') : 'Open section'}
        </summary>
        <div className={cn(card.show_header && 'mt-4')}>{children}</div>
      </details>
    )
  }

  return (
    <section className={cn(getCauseCardClasses(card), className)}>
      {card.show_header && !!title && (
        <h3 className='mb-3 text-sm font-semibold tracking-wide uppercase'>
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}
