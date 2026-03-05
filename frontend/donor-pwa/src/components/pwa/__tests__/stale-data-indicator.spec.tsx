import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { StaleDataIndicator } from '../stale-data-indicator'

describe('StaleDataIndicator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when isStale is false', () => {
    const { container } = render(
      <StaleDataIndicator isStale={false} lastFetchedAt={new Date()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when lastFetchedAt is null', () => {
    const { container } = render(
      <StaleDataIndicator isStale={true} lastFetchedAt={null} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders relative time when stale', () => {
    vi.useFakeTimers()
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    render(
      <StaleDataIndicator isStale={true} lastFetchedAt={fiveMinutesAgo} />,
    )
    expect(screen.getByRole('status')).toBeDefined()
    expect(screen.getByText(/Data from 5 minutes ago/)).toBeDefined()
  })

  it('shows "just now" for very recent data', () => {
    vi.useFakeTimers()
    const justNow = new Date(Date.now() - 10 * 1000) // 10 seconds ago
    render(
      <StaleDataIndicator isStale={true} lastFetchedAt={justNow} />,
    )
    expect(screen.getByText(/Data from just now/)).toBeDefined()
  })
})
