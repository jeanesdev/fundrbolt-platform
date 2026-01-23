import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventSelector } from '../EventSelector'
import { useEventContext, type UseEventContextReturn } from '@/hooks/use-event-context'

vi.mock('@/hooks/use-event-context')

vi.mock('@/components/ui/sidebar', async () => {
  const React = await import('react')
  return {
    SidebarMenu: ({ children }: { children: React.ReactNode }) => (
      <ul data-testid='sidebar-menu'>{children}</ul>
    ),
    SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
      <li>{children}</li>
    ),
    SidebarMenuButton: React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
      ({ children, ...props }, ref) => (
        <button type='button' ref={ref} {...props}>
          {children}
        </button>
      )
    ),
    useSidebar: () => ({ isMobile: false }),
  }
})

vi.mock('@/components/ui/dropdown-menu', () => {
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: any) => (
      <button type='button' onClick={onClick}>
        {children}
      </button>
    ),
    DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

vi.mock('@/components/ui/command', () => {
  return {
    Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandInput: ({ placeholder, value, onValueChange }: any) => (
      <input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      />
    ),
    CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandItem: ({ children, onSelect }: any) => (
      <button type='button' onClick={() => onSelect?.()}>
        {children}
      </button>
    ),
  }
})

vi.mock('@/components/ui/initial-avatar', () => ({
  InitialAvatar: ({ name }: { name: string }) => (
    <div data-testid='initial-avatar'>{name}</div>
  ),
}))

describe('EventSelector', () => {
  const mockUseEventContext = vi.mocked(useEventContext)

  const setupContext = (overrides: Partial<UseEventContextReturn> = {}) => {
    const defaultContext: UseEventContextReturn = {
      selectedEventId: null,
      selectedEventName: null,
      selectedEventSlug: null,
      isManualSelection: false,
      availableEvents: [],
      isLoading: false,
      error: null,
      selectEvent: vi.fn(),
      clearEvent: vi.fn(),
      isEventSelected: false,
      hasMultipleEvents: false,
      shouldShowSearch: false,
    }

    const value: UseEventContextReturn = {
      ...defaultContext,
      ...overrides,
    }

    mockUseEventContext.mockReturnValue(value)
    return value
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state while events load', () => {
    setupContext({ isLoading: true })

    render(<EventSelector />)

    expect(screen.getByText('Loading events...')).toBeInTheDocument()
  })

  it('renders empty state when no events are available', () => {
    setupContext({ availableEvents: [], isLoading: false })

    render(<EventSelector />)

    expect(screen.getByText('No Events')).toBeInTheDocument()
    expect(screen.getByText('Create an event to get started')).toBeInTheDocument()
  })

  it('shows search input when shouldShowSearch is true', () => {
    setupContext({
      shouldShowSearch: true,
      availableEvents: Array.from({ length: 12 }, (_, i) => ({
        id: `event-${i + 1}`,
        name: `Event ${i + 1}`,
        slug: `event-${i + 1}`,
        status: 'active',
        event_datetime: '2026-02-01T18:00:00Z',
      })),
    })

    render(<EventSelector />)

    expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument()
  })

  it('filters events and selects via command list', async () => {
    const selectEvent = vi.fn()
    setupContext({
      shouldShowSearch: true,
      selectEvent,
      availableEvents: [
        { id: 'event-1', name: 'Alpha Event', slug: 'alpha-event', status: 'active', event_datetime: '2026-02-01T18:00:00Z' },
        { id: 'event-2', name: 'Beta Event', slug: 'beta-event', status: 'draft', event_datetime: '2026-03-01T18:00:00Z' },
      ],
    })

    render(<EventSelector />)

    const input = screen.getByPlaceholderText('Search events...') as HTMLInputElement
    const user = userEvent.setup()
    await user.type(input, 'Beta')

    expect(
      screen.queryByRole('button', { name: /Alpha Event/i })
    ).not.toBeInTheDocument()

    const betaOption = screen.getByRole('button', { name: /Beta Event/i })
    await user.click(betaOption)

    expect(selectEvent).toHaveBeenCalledWith('event-2', 'Beta Event', 'beta-event')
    expect(input.value).toBe('')
  })

  it('renders dropdown items for fewer than 10 events and handles selection', async () => {
    const selectEvent = vi.fn()
    setupContext({
      shouldShowSearch: false,
      selectEvent,
      selectedEventId: 'event-1',
      selectedEventName: 'Alpha Event',
      availableEvents: [
        { id: 'event-1', name: 'Alpha Event', slug: 'alpha-event', status: 'active', event_datetime: '2026-02-01T18:00:00Z' },
        { id: 'event-2', name: 'Beta Event', slug: 'beta-event', status: 'draft', event_datetime: '2026-03-01T18:00:00Z' },
      ],
    })

    render(<EventSelector />)

    expect(
      screen.getAllByRole('button', { name: /Alpha Event/i }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: /Beta Event/i }).length
    ).toBeGreaterThan(0)
    expect(screen.getByText('✓')).toBeInTheDocument()

    const user = userEvent.setup()
    const betaButton = screen.getAllByRole('button', { name: /Beta Event/i })[0]
    await user.click(betaButton)

    expect(selectEvent).toHaveBeenCalledWith('event-2', 'Beta Event', 'beta-event')
  })
})
