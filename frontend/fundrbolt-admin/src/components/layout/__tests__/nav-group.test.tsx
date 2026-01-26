import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NavGroup } from '../nav-group'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useLocation: ({ select }: { select?: (location: { href: string }) => string } = {}) => {
    const location = { href: '/events/gala-night/details' }
    return select ? select(location) : location
  },
}))

vi.mock('@/components/ui/sidebar', () => {
  const setOpenMobile = vi.fn()
  const SidebarContext = {
    state: 'expanded',
    isMobile: false,
    setOpenMobile,
  }

  const passthrough = (Tag: keyof JSX.IntrinsicElements) =>
    ({ children, ...props }: { children?: React.ReactNode }) => (
      <Tag {...props}>{children}</Tag>
    )

  return {
    SidebarGroup: passthrough('div'),
    SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    SidebarMenu: passthrough('ul'),
    SidebarMenuItem: passthrough('li'),
    SidebarMenuButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button type='button' {...props}>
        {children}
      </button>
    ),
    SidebarMenuSub: passthrough('ul'),
    SidebarMenuSubItem: passthrough('li'),
    SidebarMenuSubButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button type='button' {...props}>
        {children}
      </button>
    ),
    useSidebar: () => SidebarContext,
  }
})

vi.mock('@/components/ui/collapsible', () => {
  const CollapsibleContext = React.createContext(true)

  const Collapsible = ({ open = true, children }: { open?: boolean; children: React.ReactNode }) => (
    <CollapsibleContext.Provider value={open}>{children}</CollapsibleContext.Provider>
  )

  const CollapsibleContent = ({ children }: { children: React.ReactNode }) => {
    const open = React.useContext(CollapsibleContext)
    if (!open) return null
    return <div>{children}</div>
  }

  const CollapsibleTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>

  return { Collapsible, CollapsibleContent, CollapsibleTrigger }
})

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

describe('NavGroup', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders navigation links', () => {
    render(
      <NavGroup
        title='General'
        items={[
          {
            title: 'Dashboard',
            url: '/',
          },
        ]}
      />
    )

    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('persists collapsed state to localStorage', () => {
    render(
      <NavGroup
        title='Event: Gala Night'
        items={[
          {
            title: 'Details',
            url: '/events/1/details',
          },
        ]}
      />
    )

    const toggleButton = screen.getByRole('button', { name: /Collapse Event: Gala Night/i })
    fireEvent.click(toggleButton)

    expect(localStorage.getItem('fundrbolt-nav-group-event-gala-night-collapsed')).toBe('true')
  })

  it('honors defaultCollapsed when no stored preference exists', () => {
    render(
      <NavGroup
        title='Admin'
        defaultCollapsed
        items={[
          {
            title: 'Dashboard',
            url: '/',
          },
        ]}
      />
    )

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})
