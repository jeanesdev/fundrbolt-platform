/**
 * Tests for BidSliderModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BidSliderModal } from '../BidSliderModal';

// Mock Radix UI Dialog
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Overlay: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div role="dialog">{children}</div>,
  Title: ({ children }: any) => <h2>{children}</h2>,
  Description: ({ children }: any) => <p>{children}</p>,
}));

// Mock Radix UI Slider
vi.mock('@radix-ui/react-slider', () => ({
  Root: ({ children, ...props }: any) => <div role="slider" {...props}>{children}</div>,
  Track: ({ children }: any) => <div>{children}</div>,
  Range: () => <div />,
  Thumb: () => <div />,
}));

// Mock BidConfirmSlide
vi.mock('../BidConfirmSlide', () => ({
  BidConfirmSlide: ({ onConfirm }: any) => (
    <button onClick={onConfirm}>Confirm Bid</button>
  ),
}));

describe('BidSliderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockItem = {
    id: 'test-item-id',
    title: 'Test Item',
    current_bid_amount: 100,
    min_next_bid_amount: 110,
    bid_increment: 10,
    starting_bid: 50,
    auction_type: 'silent' as const,
  };

  it('renders when open', () => {
    render(
      <BidSliderModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onPlaceBid={vi.fn()}
        onPlaceMaxBid={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <BidSliderModal
        isOpen={false}
        onClose={vi.fn()}
        item={mockItem}
        onPlaceBid={vi.fn()}
        onPlaceMaxBid={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays item title', () => {
    render(
      <BidSliderModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onPlaceBid={vi.fn()}
        onPlaceMaxBid={vi.fn()}
      />
    );

    expect(screen.getByText(/Test Item/i)).toBeInTheDocument();
  });

  it('shows minimum bid amount', () => {
    render(
      <BidSliderModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onPlaceBid={vi.fn()}
        onPlaceMaxBid={vi.fn()}
      />
    );

    expect(screen.getByText(/\$110/)).toBeInTheDocument();
  });

  it('shows Place Bid button', () => {
    render(
      <BidSliderModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onPlaceBid={vi.fn()}
        onPlaceMaxBid={vi.fn()}
      />
    );

    expect(screen.getByText(/Place Bid/i)).toBeInTheDocument();
  });

  it('shows Set as Max Bid button for silent auctions', () => {
    render(
      <BidSliderModal
        isOpen={true}
        onClose={vi.fn()}
        item={mockItem}
        onPlaceBid={vi.fn()}
        onPlaceMaxBid={vi.fn()}
      />
    );

    expect(screen.getByText(/Set as Max Bid/i)).toBeInTheDocument();
  });

  it('hides Set as Max Bid button for live auctions', () => {
    const liveItem = { ...mockItem, auction_type: 'live' as const };
    
    render(
      <BidSliderModal
        isOpen={true}
        onClose={vi.fn()}
        item={liveItem}
        onPlaceBid={vi.fn()}
        onPlaceMaxBid={vi.fn()}
      />
    );

    expect(screen.queryByText(/Set as Max Bid/i)).not.toBeInTheDocument();
  });
});
