import { EventHomePage } from '@/features/events/EventHomePage'
import { createFileRoute } from '@tanstack/react-router'

type EventHomeSearch = {
  item?: string
  tab?: string
}

/**
 * Event Homepage Route
 * Immersive, event-branded homepage for donors
 */
export const Route = createFileRoute('/_authenticated/events/$eventSlug/')({
  component: EventHomePage,
  validateSearch: (search: Record<string, unknown>): EventHomeSearch => ({
    item: typeof search.item === 'string' ? search.item : undefined,
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
})
