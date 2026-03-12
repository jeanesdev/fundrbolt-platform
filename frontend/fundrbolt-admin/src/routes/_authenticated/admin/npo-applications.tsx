import { createFileRoute, redirect } from '@tanstack/react-router'
import NPOApplicationsPage from '@/pages/admin/npo-applications'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/admin/npo-applications')({
  beforeLoad: () => {
    // Only super_admin can access this page
    const user = useAuthStore.getState().user
    if (user?.role !== 'super_admin') {
      throw redirect({
        to: '/',
      })
    }
  },
  component: NPOApplicationsPage,
})
