import { BottomNav } from '@/components/layout/bottom-nav'
import { Outlet } from '@tanstack/react-router'

export function Settings() {
  return (
    <div className='flex min-h-svh flex-col'>
      <div className='flex-1 overflow-y-auto pb-20'>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
