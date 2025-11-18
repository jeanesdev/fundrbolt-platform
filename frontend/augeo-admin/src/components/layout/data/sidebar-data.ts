import { Logo } from '@/assets/logo'
import {
  Building2,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Augeo Platform',
      logo: Logo,
      plan: 'Admin Portal',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
        {
          title: 'Organizations',
          url: '/npos',
          icon: Building2,
        },
        {
          title: 'Events',
          url: '/events',
          icon: Calendar,
        },
        {
          title: 'NPO Applications',
          url: '/admin/npo-applications',
          icon: ClipboardList,
        },
      ],
    },
  ],
}
