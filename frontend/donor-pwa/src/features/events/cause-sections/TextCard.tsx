import type { PublicCauseSectionCard } from '@/lib/api/cause-section-cards'
import { CauseSectionShell } from './CauseSectionShell'

export function TextCard({ card }: { card: PublicCauseSectionCard }) {
  return (
    <CauseSectionShell card={card}>
      <div
        className='prose prose-sm max-w-none text-slate-700 [&_a]:font-medium [&_a]:text-blue-600'
        dangerouslySetInnerHTML={{ __html: card.content_html ?? '' }}
      />
    </CauseSectionShell>
  )
}
