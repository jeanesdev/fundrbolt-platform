import auctionItemService from '@/services/auctionItemService';
import type {
  AuctionItem,
  AuctionItemCreate,
  AuctionItemDetail,
  AuctionItemListResponse,
  AuctionItemUpdate,
  AuctionType,
  ItemStatus,
} from '@/types/auction-item';
import { create } from 'zustand';

interface AuctionItemState {
  // State
  items: AuctionItem[];
  selectedItem: AuctionItemDetail | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: {
    auctionType?: AuctionType;
    status?: ItemStatus;
    search?: string;
    page: number;
    limit: number;
  };

  // Actions - List & Get
  fetchAuctionItems: (eventId: string) => Promise<void>;
  getAuctionItem: (eventId: string, itemId: string) => Promise<void>;
  clearSelectedItem: () => void;

  // Actions - Create/Update/Delete
  createAuctionItem: (
    eventId: string,
    data: AuctionItemCreate
  ) => Promise<AuctionItem>;
  updateAuctionItem: (
    eventId: string,
    itemId: string,
    data: AuctionItemUpdate
  ) => Promise<void>;
  deleteAuctionItem: (eventId: string, itemId: string) => Promise<void>;

  // Actions - Filters
  setFilters: (filters: Partial<AuctionItemState['filters']>) => void;
  clearFilters: () => void;

  // Utilities
  clearError: () => void;
  reset: () => void;
}

const defaultFilters = {
  page: 1,
  limit: 50,
};

const initialState = {
  items: [],
  selectedItem: null,
  pagination: null,
  isLoading: false,
  error: null,
  filters: defaultFilters,
};

export const useAuctionItemStore = create<AuctionItemState>((set, get) => ({
  ...initialState,

  // Fetch auction items for an event with current filters
  fetchAuctionItems: async (eventId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const response: AuctionItemListResponse =
        await auctionItemService.listAuctionItems(eventId, {
          auctionType: filters.auctionType,
          status: filters.status,
          search: filters.search,
          page: filters.page,
          limit: filters.limit,
        });

      set({
        items: response.items,
        pagination: response.pagination,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch auction items';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Get a single auction item with full details
  getAuctionItem: async (eventId: string, itemId: string) => {
    set({ isLoading: true, error: null });
    try {
      const item = await auctionItemService.getAuctionItem(eventId, itemId);
      set({ selectedItem: item, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch auction item';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearSelectedItem: () => {
    set({ selectedItem: null });
  },

  // Create a new auction item
  createAuctionItem: async (eventId: string, data: AuctionItemCreate) => {
    set({ isLoading: true, error: null });
    try {
      const newItem = await auctionItemService.createAuctionItem(
        eventId,
        data
      );

      // Add to items list
      set((state) => ({
        items: [...state.items, newItem],
        isLoading: false,
      }));

      return newItem;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create auction item';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Update an existing auction item
  updateAuctionItem: async (
    eventId: string,
    itemId: string,
    data: AuctionItemUpdate
  ) => {
    set({ isLoading: true, error: null });
    try {
      const updatedItem = await auctionItemService.updateAuctionItem(
        eventId,
        itemId,
        data
      );

      // Update in items list
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? updatedItem : item
        ),
        selectedItem:
          state.selectedItem?.id === itemId
            ? { ...state.selectedItem, ...updatedItem }
            : state.selectedItem,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update auction item';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Delete an auction item
  deleteAuctionItem: async (eventId: string, itemId: string) => {
    set({ isLoading: true, error: null });
    try {
      await auctionItemService.deleteAuctionItem(eventId, itemId);

      // Remove from items list
      set((state) => ({
        items: state.items.filter((item) => item.id !== itemId),
        selectedItem:
          state.selectedItem?.id === itemId ? null : state.selectedItem,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to delete auction item';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Set filters and reset to page 1
  setFilters: (newFilters: Partial<AuctionItemState['filters']>) => {
    set((state) => ({
      filters: {
        ...state.filters,
        ...newFilters,
        page: newFilters.page ?? 1, // Reset to page 1 when changing filters
      },
    }));
  },

  // Clear all filters
  clearFilters: () => {
    set({ filters: defaultFilters });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));

export default useAuctionItemStore;
