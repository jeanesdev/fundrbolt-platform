/**
 * Tests for SummaryCards component
 * Focus: Rendering summary metrics and status indicators
 */

import { SummaryCards } from '@/features/event-dashboard/components/SummaryCards'
import type { DashboardSummary } from '@/types/event-dashboard'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const mockDashboard: DashboardSummary = {
  event_id: '123e4567-e89b-12d3-a456-426614174000',
  goal: {
    amount: '100000.00',
    currency: 'USD',
  },
  total_actual: {
    amount: '75000.00',
    currency: 'USD',
  },
  total_projected: {
    amount: '95000.00',
    currency: 'USD',
  },
  variance_amount: {
    amount: '25000.00',
    currency: 'USD',
  },
  variance_percent: 25.0,
  pacing: {
    status: 'on_track',
    pacing_percent: 85.0,
    trajectory: 'linear',
  },
  sources: [],
  waterfall: [],
  cashflow: [],
  funnel: [],
  alerts: [],
  last_refreshed_at: new Date().toISOString(),
}

describe('SummaryCards', () => {
  it('renders total raised card with formatted amount', () => {
    render(<SummaryCards dashboard={mockDashboard} />)

    expect(screen.getByText('Total Raised')).toBeInTheDocument()
    expect(screen.getByText('$75,000.00')).toBeInTheDocument()
    expect(screen.getByText(/of.*100,000.00.*goal/i)).toBeInTheDocument()
  })

  it('renders projected total card', () => {
    render(<SummaryCards dashboard={mockDashboard} />)

    expect(screen.getByText('Projected Total')).toBeInTheDocument()
    expect(screen.getByText('$95,000.00')).toBeInTheDocument()
  })

  it('renders variance from goal card with percentage', () => {
    render(<SummaryCards dashboard={mockDashboard} />)

    expect(screen.getByText('Variance from Goal')).toBeInTheDocument()
    expect(screen.getByText('$25,000.00')).toBeInTheDocument()
    expect(screen.getByText(/25\.0%.*under.*goal/i)).toBeInTheDocument()
  })

  it('renders pacing status as on track', () => {
    render(<SummaryCards dashboard={mockDashboard} />)

    expect(screen.getByText('Pacing Status')).toBeInTheDocument()
    expect(screen.getByText('On Track')).toBeInTheDocument()
    expect(screen.getByText(/85%.*pacing/i)).toBeInTheDocument()
  })

  it('shows off track status when pacing is below threshold', () => {
    const offTrackDashboard = {
      ...mockDashboard,
      pacing: {
        status: 'off_track' as const,
        pacing_percent: 60.0,
        trajectory: 'linear' as const,
      },
    }

    render(<SummaryCards dashboard={offTrackDashboard} />)

    expect(screen.getByText('Off Track')).toBeInTheDocument()
    expect(screen.getByText(/60%.*pacing/i)).toBeInTheDocument()
  })

  it('displays all four summary cards', () => {
    const { container } = render(<SummaryCards dashboard={mockDashboard} />)

    // Should have 4 cards in the grid
    const cards = container.querySelectorAll('[class*="gap-4"] > *')
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })
})
