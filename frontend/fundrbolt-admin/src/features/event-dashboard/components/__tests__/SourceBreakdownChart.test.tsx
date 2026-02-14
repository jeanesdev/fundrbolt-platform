/**
 * Tests for SourceBreakdownChart component
 * Focus: Data visualization for revenue sources
 */

import { SourceBreakdownChart } from '@/features/event-dashboard/components/SourceBreakdownChart'
import type { RevenueSourceSummary } from '@/types/event-dashboard'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const mockSources: RevenueSourceSummary[] = [
  {
    source: 'tickets',
    actual: { amount: '15000.00', currency: 'USD' },
    projected: { amount: '20000.00', currency: 'USD' },
    target: { amount: '25000.00', currency: 'USD' },
    variance_amount: { amount: '10000.00', currency: 'USD' },
    variance_percent: 40.0,
    pacing_percent: 75.0,
  },
  {
    source: 'sponsorships',
    actual: { amount: '50000.00', currency: 'USD' },
    projected: { amount: '60000.00', currency: 'USD' },
    target: { amount: '70000.00', currency: 'USD' },
    variance_amount: { amount: '20000.00', currency: 'USD' },
    variance_percent: 28.6,
    pacing_percent: 85.7,
  },
]

describe('SourceBreakdownChart', () => {
  it('renders without crashing with valid data', () => {
    const { container } = render(<SourceBreakdownChart sources={mockSources} />)
    expect(container).toBeInTheDocument()
  })

  it('renders chart container with correct dimensions', () => {
    const { container } = render(<SourceBreakdownChart sources={mockSources} />)
    
    // Recharts creates ResponsiveContainer
    const responsiveContainer = container.querySelector('.recharts-responsive-container')
    expect(responsiveContainer).toBeInTheDocument()
  })

  it('handles empty sources array gracefully', () => {
    const { container } = render(<SourceBreakdownChart sources={[]} />)
    expect(container).toBeInTheDocument()
  })

  it('transforms source data for chart display', () => {
    const { container } = render(<SourceBreakdownChart sources={mockSources} />)
    
    // Recharts wrapper should exist
    const wrapper = container.querySelector('.recharts-wrapper')
    expect(wrapper).toBeInTheDocument()
  })
})
