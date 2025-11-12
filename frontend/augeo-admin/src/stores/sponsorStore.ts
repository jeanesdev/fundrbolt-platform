import { create } from 'zustand';
import sponsorService from '@/services/sponsorService';
import type {
  Sponsor,
  SponsorCreateRequest,
  SponsorUpdateRequest,
  ReorderSponsorsRequest,
} from '@/types/sponsor';

interface SponsorState {
  // State
  sponsors: Sponsor[];
  isLoading: boolean;
  error: string | null;
  selectedSponsor: Sponsor | null;

  // Actions - List & Get
  fetchSponsors: (eventId: string) => Promise<void>;
  getSponsor: (eventId: string, sponsorId: string) => Promise<void>;
  clearSelectedSponsor: () => void;

  // Actions - Create/Update/Delete
  createSponsor: (
    eventId: string,
    data: SponsorCreateRequest,
    logoFile?: File
  ) => Promise<Sponsor>;
  updateSponsor: (
    eventId: string,
    sponsorId: string,
    data: SponsorUpdateRequest
  ) => Promise<void>;
  deleteSponsor: (eventId: string, sponsorId: string) => Promise<void>;

  // Actions - Logo Upload
  uploadLogo: (
    eventId: string,
    sponsorId: string,
    file: File
  ) => Promise<void>;

  // Actions - Reorder
  reorderSponsors: (
    eventId: string,
    request: ReorderSponsorsRequest
  ) => Promise<void>;

  // Utilities
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  sponsors: [],
  isLoading: false,
  error: null,
  selectedSponsor: null,
};

export const useSponsorStore = create<SponsorState>((set) => ({
  ...initialState,

  // Fetch all sponsors for an event
  fetchSponsors: async (eventId: string) => {
    set({ isLoading: true, error: null });
    try {
      const sponsors = await sponsorService.listSponsors(eventId);
      set({ sponsors, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch sponsors';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Get a single sponsor
  getSponsor: async (eventId: string, sponsorId: string) => {
    set({ isLoading: true, error: null });
    try {
      const sponsor = await sponsorService.getSponsor(eventId, sponsorId);
      set({ selectedSponsor: sponsor, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch sponsor';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearSelectedSponsor: () => {
    set({ selectedSponsor: null });
  },

  // Create a new sponsor (with optional logo upload)
  createSponsor: async (
    eventId: string,
    data: SponsorCreateRequest,
    logoFile?: File
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await sponsorService.createSponsor(eventId, data);

      let finalSponsor = response.sponsor;

      // If logo file provided, upload it
      if (logoFile) {
        finalSponsor = await sponsorService.uploadLogo(
          eventId,
          response.sponsor.id,
          logoFile
        );
      }

      // Add to sponsors list
      set((state) => ({
        sponsors: [...state.sponsors, finalSponsor],
        isLoading: false,
      }));

      return finalSponsor;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create sponsor';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Update an existing sponsor
  updateSponsor: async (
    eventId: string,
    sponsorId: string,
    data: SponsorUpdateRequest
  ) => {
    set({ isLoading: true, error: null });
    try {
      const updatedSponsor = await sponsorService.updateSponsor(
        eventId,
        sponsorId,
        data
      );

      // Update in sponsors list
      set((state) => ({
        sponsors: state.sponsors.map((s) =>
          s.id === sponsorId ? updatedSponsor : s
        ),
        selectedSponsor:
          state.selectedSponsor?.id === sponsorId
            ? updatedSponsor
            : state.selectedSponsor,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update sponsor';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Delete a sponsor
  deleteSponsor: async (eventId: string, sponsorId: string) => {
    set({ isLoading: true, error: null });
    try {
      await sponsorService.deleteSponsor(eventId, sponsorId);

      // Remove from sponsors list
      set((state) => ({
        sponsors: state.sponsors.filter((s) => s.id !== sponsorId),
        selectedSponsor:
          state.selectedSponsor?.id === sponsorId
            ? null
            : state.selectedSponsor,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete sponsor';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Upload logo for existing sponsor
  uploadLogo: async (eventId: string, sponsorId: string, file: File) => {
    set({ isLoading: true, error: null });
    try {
      const updatedSponsor = await sponsorService.uploadLogo(
        eventId,
        sponsorId,
        file
      );

      // Update in sponsors list
      set((state) => ({
        sponsors: state.sponsors.map((s) =>
          s.id === sponsorId ? updatedSponsor : s
        ),
        selectedSponsor:
          state.selectedSponsor?.id === sponsorId
            ? updatedSponsor
            : state.selectedSponsor,
        isLoading: false,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload logo';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Reorder sponsors
  reorderSponsors: async (
    eventId: string,
    request: ReorderSponsorsRequest
  ) => {
    set({ isLoading: true, error: null });
    try {
      const reorderedSponsors = await sponsorService.reorderSponsors(
        eventId,
        request
      );

      set({ sponsors: reorderedSponsors, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reorder sponsors';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Reset store
  reset: () => {
    set(initialState);
  },
}));
