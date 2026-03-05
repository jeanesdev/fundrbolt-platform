import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  SidebarGroup,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
import type { NavGroup } from './types'

interface SidebarSearchProps {
  navGroups: NavGroup[]
}

export function SidebarSearch({ navGroups }: SidebarSearchProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { state, closeSidebar, isMobile } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile

  const handleSelect = useCallback(
    (url: string) => {
      setOpen(false)
      navigate({ to: url })
      closeSidebar()
    },
    [navigate, closeSidebar]
  )

  return (
    <SidebarGroup className='px-2 py-1'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <SidebarMenuButton
            tooltip='Search pages'
            className='text-muted-foreground hover:text-foreground w-full justify-start gap-2'
          >
            <Search className='size-4 shrink-0' />
            {!isCollapsed && (
              <span className='truncate text-sm'>Go to page…</span>
            )}
          </SidebarMenuButton>
        </PopoverTrigger>
        <PopoverContent
          className='w-64 p-0'
          side={isCollapsed ? 'right' : 'bottom'}
          align='start'
          sideOffset={isCollapsed ? 8 : 4}
        >
          <Command>
            <CommandInput placeholder='Search pages…' autoFocus />
            <CommandList className='max-h-72'>
              <CommandEmpty>No pages found.</CommandEmpty>
              {navGroups.map((group) => (
                <CommandGroup key={group.title} heading={group.title}>
                  {group.items.map((item) => {
                    const url =
                      'url' in item && typeof item.url === 'string'
                        ? item.url
                        : undefined
                    if (!url) return null
                    return (
                      <CommandItem
                        key={`${group.title}-${item.title}`}
                        value={`${group.title} ${item.title}`}
                        onSelect={() => handleSelect(url)}
                        className='cursor-pointer'
                      >
                        {item.icon && <item.icon className='mr-2 size-4' />}
                        <span>{item.title}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </SidebarGroup>
  )
}
