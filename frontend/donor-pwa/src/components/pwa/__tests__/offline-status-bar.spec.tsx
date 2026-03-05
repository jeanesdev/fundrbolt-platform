import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OfflineStatusBar } from '../offline-status-bar'

describe('OfflineStatusBar', () => {
  it('renders when isOnline is false', () => {
    render(<OfflineStatusBar isOnline={false} />)
    expect(screen.getByRole('alert')).toBeDefined()
    expect(
      screen.getByText(/offline.*some features may be unavailable/i),
    ).toBeDefined()
  })

  it('does not render when isOnline is true', () => {
    const { container } = render(<OfflineStatusBar isOnline={true} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the correct message text', () => {
    render(<OfflineStatusBar isOnline={false} />)
    expect(
      screen.getByText(
        "You're offline — some features may be unavailable",
      ),
    ).toBeDefined()
  })
})
