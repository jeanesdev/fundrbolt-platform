/**
 * Tests for WatchListButton component
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WatchListButton } from '../WatchListButton';

const watchListMocks = vi.hoisted(() => ({
  addToWatchList: vi.fn(),
  removeFromWatchList: vi.fn(),
}));

// Mock the services
vi.mock('@/services/watchlistService', () => ({
  __esModule: true,
  default: {
    addToWatchList: watchListMocks.addToWatchList,
    removeFromWatchList: watchListMocks.removeFromWatchList,
  },
  watchListService: {
    addToWatchList: watchListMocks.addToWatchList,
    removeFromWatchList: watchListMocks.removeFromWatchList,
  },
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

  it('calls onToggle and adds to watch list', async () => {
    watchListMocks.addToWatchList.mockResolvedValue({});
    const onToggle = vi.fn();
    renderComponent({ isWatching: false, onToggle });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(watchListMocks.addToWatchList).toHaveBeenCalledWith('test-event-id', 'test-item-id');
      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  it('calls onToggle and removes from watch list', async () => {
    watchListMocks.removeFromWatchList.mockResolvedValue(undefined);
    const onToggle = vi.fn();
    renderComponent({ isWatching: true, onToggle });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(watchListMocks.removeFromWatchList).toHaveBeenCalledWith('test-event-id', 'test-item-id');
      expect(onToggle).toHaveBeenCalledWith(false);
    });
  });
});
