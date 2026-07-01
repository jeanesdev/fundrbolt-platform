import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AuctionItemForm } from '@/features/events/components/AuctionItemForm'
import { AuctionType, type AuctionItem } from '@/types/auction-item'

vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    disabled,
    placeholder,
  }: {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
  }) => (
    <textarea
      aria-label='Description'
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

describe('AuctionItemForm - Impact Donation visibility', () => {
  const onSubmit = vi.fn(async () => undefined)
  const onCancel = vi.fn()

  const baseItem = {
    title: 'Feed a Family for a Week',
    description: 'Impact donation item',
    auction_type: AuctionType.SILENT,
    starting_bid: 0,
    bid_increment: 1,
    buy_now_enabled: true,
    quantity_available: 0,
    display_starting_bid: false,
    display_fair_market_value: false,
  }

  it('hides quantity, cost, and additional information for impact donation', () => {
    const impactItem = {
      ...baseItem,
      category: 'Impact',
    } as unknown as AuctionItem

    render(
      <AuctionItemForm
        item={impactItem}
        eventId='event-123'
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    )

    expect(screen.queryByLabelText(/quantity available/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/consignment cost/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/additional information/i)).not.toBeInTheDocument()

    expect(screen.getByLabelText(/buy now price/i)).toBeInTheDocument()
  })

  it('shows quantity, cost, and additional information for non-impact items', () => {
    const silentItem = {
      ...baseItem,
      category: 'Silent',
    } as unknown as AuctionItem

    render(
      <AuctionItemForm
        item={silentItem}
        eventId='event-123'
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    )

    expect(screen.getByLabelText(/quantity available/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/consignment cost/i)).toBeInTheDocument()
    expect(screen.getByText(/additional information/i)).toBeInTheDocument()
  })
})
