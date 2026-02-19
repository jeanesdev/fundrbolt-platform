/**
 * Tests for BidSliderModal component
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BidSliderModal } from '../BidSliderModal';

describe('BidSliderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    itemTitle: 'Test Item',
    currentBid: 100,
    minNextBid: 110,
    bidIncrement: 10,
    onPlaceBid: vi.fn(),
    onSetMaxBid: vi.fn(),
  };

  it('renders when open', () => {
    render(
      <BidSliderModal {...baseProps} />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <BidSliderModal {...baseProps} isOpen={false} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays item title', () => {
    render(
      <BidSliderModal {...baseProps} />
    );

    expect(screen.getByText(/Test Item/i)).toBeInTheDocument();
  });

  it('shows minimum bid amount', () => {
    render(
      <BidSliderModal {...baseProps} />
    );

    const minBidLabel = screen.getByText(/Minimum Next Bid/i);
    expect(minBidLabel.parentElement).toHaveTextContent('$110');
  });

  it('shows Place Bid button', () => {
    render(
      <BidSliderModal {...baseProps} />
    );

    expect(screen.getByRole('button', { name: /Place Bid/i })).toBeInTheDocument();
  });

  it('shows Set as Max Bid button when allowed', () => {
    render(
      <BidSliderModal {...baseProps} allowMaxBid={true} />
    );

    expect(screen.getByText(/Set as Max Bid/i)).toBeInTheDocument();
  });

  it('hides Set as Max Bid button when disallowed', () => {
    render(
      <BidSliderModal {...baseProps} allowMaxBid={false} />
    );

    expect(screen.queryByText(/Set as Max Bid/i)).not.toBeInTheDocument();
  });
});
