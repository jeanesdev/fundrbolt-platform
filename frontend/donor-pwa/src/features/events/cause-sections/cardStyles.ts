import type { PublicCauseSectionCard } from '@/lib/api/cause-section-cards'

const backgroundTokenClass: Record<string, string> = {
  'slate-50': 'bg-slate-50',
  'slate-100': 'bg-slate-100',
  'slate-200': 'bg-slate-200',
  white: 'bg-white',
  transparent: 'bg-transparent',
}

const borderTokenClass: Record<string, string> = {
  'slate-50': 'border-slate-50',
  'slate-100': 'border-slate-100',
  'slate-200': 'border-slate-200',
  white: 'border-white',
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
