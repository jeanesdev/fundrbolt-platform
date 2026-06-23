import type { PublicCauseSectionCard } from '@/lib/api/cause-section-cards'
import type { CSSProperties } from 'react'

const backgroundTokenClass: Record<string, string> = {
  'slate-50': 'bg-[rgb(var(--event-background,255,255,255)/0.86)]',
  'slate-100': 'bg-[rgb(var(--event-background,255,255,255)/0.9)]',
  'slate-200': 'bg-[rgb(var(--event-background,255,255,255)/0.94)]',
  white: 'bg-[rgb(var(--event-background,255,255,255))]',
  transparent: 'bg-transparent',
}

const borderTokenClass: Record<string, string> = {
  'slate-50': 'border-[var(--event-cause-border-color,#3B82F6)]',
  'slate-100': 'border-[var(--event-cause-border-color,#3B82F6)]',
  'slate-200': 'border-[var(--event-cause-border-color,#3B82F6)]',
  white: 'border-[var(--event-cause-border-color,#3B82F6)]',
  transparent: 'border-transparent',
}

export function getCauseCardClasses(card: PublicCauseSectionCard) {
  return [
    'rounded-2xl border p-4 shadow-sm',
    backgroundTokenClass[card.background_color_token ?? 'white'] ?? 'bg-white',
    borderTokenClass[card.border_color_token ?? 'slate-200'] ??
    'border-slate-200',
  ].join(' ')
}

export function getCauseCardStyle(card: PublicCauseSectionCard): CSSProperties {
  if (card.border_color_token === 'transparent') {
    return { borderWidth: '0px' }
  }

  return {
    borderWidth: 'var(--event-cause-border-width, 1px)',
  }
}
