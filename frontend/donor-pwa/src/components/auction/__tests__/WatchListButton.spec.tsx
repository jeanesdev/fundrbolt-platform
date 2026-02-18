/**
 * Tests for WatchListButton component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WatchListButton } from '../WatchListButton';

// Mock the services
vi.mock('@/services/watchlistService', () => ({
  addToWatchList: vi.fn(),
  removeFromWatchList: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('WatchListButton', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      itemId: 'test-item-id',
      eventId: 'test-event-id',
      isWatching: false,
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <WatchListButton {...defaultProps} />
      </QueryClientProvider>
    );
  };

  it('renders with not watching state', () => {
    renderComponent({ isWatching: false });
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('renders with watching state', () => {
    renderComponent({ isWatching: true });
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('shows icon variant when variant is icon', () => {
    renderComponent({ variant: 'icon', isWatching: false });
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    renderComponent({ disabled: true });
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('calls onClick when provided', async () => {
    const onClick = vi.fn();
    renderComponent({ onClick });
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(onClick).toHaveBeenCalled();
    });
  });
});
