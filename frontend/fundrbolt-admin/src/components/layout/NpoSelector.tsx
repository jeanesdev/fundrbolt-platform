/**
 * NpoSelector Component
 * Dropdown selector for NPO context with role-based visibility and auto-selection
 *
 * Business Rules:
 * - SuperAdmin: Can select any NPO or "Fundrbolt Platform" (null)
 * - NPO Admin/Staff: Shows only their NPO (non-clickable, disabled)
 * - Event Coordinator: Shows NPOs they're registered with
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useNpoContext } from '@/hooks/use-npo-context'
import { Building2, ChevronsUpDown } from 'lucide-react'

export function NpoSelector() {
  const { isMobile } = useSidebar()
  const {
    selectedNpoId,
    selectedNpoName,
    availableNpos,
    selectNpo,
    isFundrboltPlatformView,
    isSingleNpoUser,
    canChangeNpo,
  } = useNpoContext()

  // Get selected NPO's logo if available
  const selectedNpo = availableNpos.find((npo) => npo.id === selectedNpoId)
  const selectedNpoLogo = selectedNpo?.logo_url

  // T061: For single-NPO users, show name only (not clickable)
  if (isSingleNpoUser && !canChangeNpo) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size='lg'
            className='cursor-default'
            disabled
          >
            <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden'>
              {selectedNpoLogo ? (
                <img
                  src={selectedNpoLogo}
                  alt={selectedNpoName}
                  className='size-full object-cover'
                />
              ) : (
                <Building2 className='size-4' />
              )}
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-semibold'>
                {selectedNpoName}
              </span>
              <span className='truncate text-xs'>My Organization</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // For users who can change NPO (SuperAdmin, Event Coordinator with multiple NPOs)
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden'>
                {selectedNpoLogo ? (
                  <img
                    src={selectedNpoLogo}
                    alt={selectedNpoName}
                    className='size-full object-cover'
                  />
                ) : (
                  <Building2 className='size-4' />
                )}
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {selectedNpoName}
                </span>
                <span className='truncate text-xs'>
                  {isFundrboltPlatformView ? 'All Organizations' : 'Organization'}
                </span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-muted-foreground text-xs'>
              Organizations
            </DropdownMenuLabel>
            {availableNpos.map((npo) => (
              <DropdownMenuItem
                key={npo.id || 'platform'}
                onClick={() => selectNpo(npo.id, npo.name)}
                className='gap-2 p-2'
              >
                <div className='flex size-6 items-center justify-center rounded-sm border overflow-hidden'>
                  {npo.logo_url ? (
                    <img
                      src={npo.logo_url}
                      alt={npo.name}
                      className='size-full object-cover'
                    />
                  ) : (
                    <Building2 className='size-4 shrink-0' />
                  )}
                </div>
                <div className='flex-1'>
                  <div className='font-medium'>{npo.name}</div>
                  {npo.id === null && (
                    <div className='text-muted-foreground text-xs'>View all organizations</div>
                  )}
                </div>
                {selectedNpoId === npo.id && (
                  <span className='text-primary text-xs'>✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
