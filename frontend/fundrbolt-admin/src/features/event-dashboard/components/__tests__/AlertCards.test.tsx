import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AlertCards } from '../AlertCards'

describe('AlertCards', () => {
  it('uses readable text color for alert descriptions', () => {
    render(
      <AlertCards
        alerts={[
          {
            source: 'silent_auction',
            status: 'active',
            threshold_percent: 85,
            consecutive_refreshes: 3,
          },
        ]}
      />
    )

    expect(
      screen.getByText('Silent Auction is below target pacing')
    ).toBeInTheDocument()

    expect(screen.getByText(/Below 85% target for 3 refreshes\./)).toHaveClass(
      'text-foreground',
      'font-medium'
    )
  })

  it('renders nothing when there are no alerts', () => {
    const { container } = render(<AlertCards alerts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
