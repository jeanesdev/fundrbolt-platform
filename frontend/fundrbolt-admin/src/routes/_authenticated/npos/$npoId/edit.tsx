import { createFileRoute } from '@tanstack/react-router'
import EditNPOPage from '@/pages/npo/edit-npo'

export const Route = createFileRoute('/_authenticated/npos/$npoId/edit')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search.tab === 'branding' || search.tab === 'payments'
        ? search.tab
        : 'details',
  }),
  component: EditNPOPage,
})
