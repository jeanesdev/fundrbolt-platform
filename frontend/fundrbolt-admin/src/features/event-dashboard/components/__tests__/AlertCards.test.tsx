/**
 * Tests for AlertCards component
 * Focus: Display of performance alerts
 */

import { AlertCards } from '@/features/event-dashboard/components/AlertCards'
import type { AlertCard } from '@/types/event-dashboard'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const mockAlerts: AlertCard[] = [
  {
    source: 'sponsorships',
    status: 'active',
    threshold_percent: 90.0,
    consecutive_refreshes: 3,
    triggered_at: '2026-02-07T10:00:00Z',
  },
  {
    source: 'silent_auction',
    status: 'active',
    threshold_percent: 90.0,
    consecutive_refreshes: 2,
    triggered_at: '2026-02-07T11:00:00Z',
  },
]

describe('AlertCards', () => {
  it('renders alert cards for each alert', () => {
    render(<AlertCards alerts={mockAlerts} />)

    expect(screen.getByText(/Sponsorships.*Underperforming/i)).toBeInTheDocument()
    expect(screen.getByText(/Silent Auction.*Underperforming/i)).toBeInTheDocument()
  })

  it('displays alert details including threshold and consecutive refreshes', () => {
    render(<AlertCards alerts={mockAlerts} />)

    expect(screen.getByText(/Below 90%.*3 consecutive refreshes/i)).toBeInTheDocument()
    expect(screen.getByText(/Below 90%.*2 consecutive refreshes/i)).toBeInTheDocument()
  })

  it('does not render section when no alerts', () => {
    const { container } = render(<AlertCards alerts={[]} />)

    // Component returns null for empty alerts
    expect(container.firstChild).toBeNull()
  })

  it('renders performance alerts header when alerts exist', () => {
    render(<AlertCards alerts={mockAlerts} />)

    expect(screen.getByText('Performance Alerts')).toBeInTheDocument()
  })

  it('formats source names correctly', () => {
    render(<AlertCards alerts={mockAlerts} />)

    // "silent_auction" should be formatted as "Silent Auction"
    expect(screen.getByText(/Silent Auction.*Underperforming/i)).toBeInTheDocument()
  })
})
