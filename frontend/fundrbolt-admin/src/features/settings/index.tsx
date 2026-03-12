import { Outlet } from '@tanstack/react-router'
import { KeyRound, Shield, UserCog } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { SettingsBottomNav } from '@/components/layout/settings-bottom-nav'
import { Search } from '@/components/search'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  {
    title: 'Profile',
    href: '/settings',
    icon: <UserCog size={18} />,
  },
  {
    title: 'Password',
    href: '/settings/password',
    icon: <KeyRound size={18} />,
  },
  {
    title: 'Privacy & Consent',
    href: '/settings/consent',
    icon: <Shield size={18} />,
  },
]

export function Settings() {
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Settings
          </h1>
          <p className='text-muted-foreground'>
            Manage your account settings and set e-mail preferences.
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex w-full p-1 pb-20'>
          <Outlet />
        </div>
      </Main>

      <SettingsBottomNav />
    </>
  )
}
