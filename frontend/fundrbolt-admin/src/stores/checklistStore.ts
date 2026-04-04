import checklistService from '@/services/checklistService'
import type {
  ApplyTemplateRequest,
  ChecklistItem,
  ChecklistItemCreate,
  ChecklistItemStatusUpdate,
  ChecklistItemUpdate,
  ChecklistReorderRequest,
  ChecklistResponse,
  ChecklistTemplate,
  ChecklistTemplateDetail,
  ChecklistTemplateUpdate,
  SaveAsTemplateRequest,
} from '@/types/checklist'
import { create } from 'zustand'

interface ChecklistState {
  // Checklist state
  checklist: ChecklistResponse | null
  isLoading: boolean
  error: string | null

  // Template state
  templates: ChecklistTemplate[]
  selectedTemplate: ChecklistTemplateDetail | null
  templatesLoading: boolean

  // Checklist actions
  fetchChecklist: (eventId: string) => Promise<void>
  createItem: (eventId: string, data: ChecklistItemCreate) => Promise<void>
  updateItem: (
    eventId: string,
    itemId: string,
    data: ChecklistItemUpdate
  ) => Promise<void>
  updateItemStatus: (
    eventId: string,
    itemId: string,
    data: ChecklistItemStatusUpdate
  ) => Promise<void>
  deleteItem: (eventId: string, itemId: string) => Promise<void>
  reorderItems: (
    eventId: string,
    data: ChecklistReorderRequest
  ) => Promise<void>

  // Template actions
  fetchTemplates: (npoId: string) => Promise<void>
  getTemplate: (npoId: string, templateId: string) => Promise<void>
  applyTemplate: (eventId: string, data: ApplyTemplateRequest) => Promise<void>
  saveAsTemplate: (
    eventId: string,
    data: SaveAsTemplateRequest
  ) => Promise<ChecklistTemplate>
  updateTemplate: (
    npoId: string,
    templateId: string,
    data: ChecklistTemplateUpdate
  ) => Promise<void>
  deleteTemplate: (npoId: string, templateId: string) => Promise<void>
  setDefaultTemplate: (npoId: string, templateId: string) => Promise<void>

  // Utilities
  clearError: () => void
  reset: () => void
}

const initialState = {
  checklist: null,
  isLoading: false,
  error: null,
  templates: [],
  selectedTemplate: null,
  templatesLoading: false,
}

export const useChecklistStore = create<ChecklistState>((set) => ({
  ...initialState,

  fetchChecklist: async (eventId: string) => {
    set({ isLoading: true, error: null })
    try {
      const checklist = await checklistService.getEventChecklist(eventId)
      set({ checklist, isLoading: false })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch checklist'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  createItem: async (eventId: string, data: ChecklistItemCreate) => {
    set({ error: null })
    try {
      const newItem = await checklistService.createItem(eventId, data)
      set((state) => {
        if (!state.checklist) return state
        const items = [...state.checklist.items, newItem]
        return {
          checklist: {
            ...state.checklist,
            items,
            total_count: items.length,
            completed_count: items.filter((i) => i.status === 'complete')
              .length,
            in_progress_count: items.filter((i) => i.status === 'in_progress')
              .length,
            overdue_count: items.filter((i) => i.is_overdue).length,
            progress_percentage:
              items.length > 0
                ? (items.filter((i) => i.status === 'complete').length /
                    items.length) *
                  100
                : 0,
          },
        }
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create item'
      set({ error: message })
      throw error
    }
  },

  updateItem: async (
    eventId: string,
    itemId: string,
    data: ChecklistItemUpdate
  ) => {
    set({ error: null })
    try {
      const updated = await checklistService.updateItem(eventId, itemId, data)
      set((state) => {
        if (!state.checklist) return state
        const items = state.checklist.items.map((i) =>
          i.id === itemId ? updated : i
        )
        return {
          checklist: {
            ...state.checklist,
            items,
            overdue_count: items.filter((i) => i.is_overdue).length,
          },
        }
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update item'
      set({ error: message })
      throw error
    }
  },

  updateItemStatus: async (
    eventId: string,
    itemId: string,
    data: ChecklistItemStatusUpdate
  ) => {
    // Optimistic update
    set((state) => {
      if (!state.checklist) return state
      const items = state.checklist.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: data.status,
              completed_at:
                data.status === 'complete' ? new Date().toISOString() : null,
            }
          : i
      )
      return {
        checklist: {
          ...state.checklist,
          items,
          completed_count: items.filter((i) => i.status === 'complete').length,
          in_progress_count: items.filter((i) => i.status === 'in_progress')
            .length,
          progress_percentage:
            items.length > 0
              ? (items.filter((i) => i.status === 'complete').length /
                  items.length) *
                100
              : 0,
        },
      }
    })

    try {
      const updated = await checklistService.updateItemStatus(
        eventId,
        itemId,
        data
      )
      // Replace with server response
      set((state) => {
        if (!state.checklist) return state
        const items = state.checklist.items.map((i) =>
          i.id === itemId ? updated : i
        )
        return {
          checklist: {
            ...state.checklist,
            items,
            completed_count: items.filter((i) => i.status === 'complete')
              .length,
            in_progress_count: items.filter((i) => i.status === 'in_progress')
              .length,
            overdue_count: items.filter((i) => i.is_overdue).length,
            progress_percentage:
              items.length > 0
                ? (items.filter((i) => i.status === 'complete').length /
                    items.length) *
                  100
                : 0,
          },
        }
      })
    } catch (error) {
      // Revert on failure — refetch
      const message =
        error instanceof Error ? error.message : 'Failed to update item status'
      set({ error: message })
      try {
        const checklist = await checklistService.getEventChecklist(eventId)
        set({ checklist })
      } catch {
        // Best effort revert
      }
      throw error
    }
  },

  deleteItem: async (eventId: string, itemId: string) => {
    set({ error: null })
    try {
      await checklistService.deleteItem(eventId, itemId)
      set((state) => {
        if (!state.checklist) return state
        const items = state.checklist.items.filter((i) => i.id !== itemId)
        return {
          checklist: {
            ...state.checklist,
            items,
            total_count: items.length,
            completed_count: items.filter((i) => i.status === 'complete')
              .length,
            in_progress_count: items.filter((i) => i.status === 'in_progress')
              .length,
            overdue_count: items.filter((i) => i.is_overdue).length,
            progress_percentage:
              items.length > 0
                ? (items.filter((i) => i.status === 'complete').length /
                    items.length) *
                  100
                : 0,
          },
        }
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete item'
      set({ error: message })
      throw error
    }
  },

  reorderItems: async (eventId: string, data: ChecklistReorderRequest) => {
    // Optimistic reorder
    set((state) => {
      if (!state.checklist) return state
      const itemMap = new Map(state.checklist.items.map((i) => [i.id, i]))
      const reordered = data.item_ids
        .map((id) => itemMap.get(id))
        .filter((i): i is ChecklistItem => i !== undefined)
        .map((item, index) => ({ ...item, display_order: index }))
      return { checklist: { ...state.checklist, items: reordered } }
    })

    try {
      const checklist = await checklistService.reorderItems(eventId, data)
      set({ checklist })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reorder items'
      set({ error: message })
      // Refetch on failure
      try {
        const checklist = await checklistService.getEventChecklist(eventId)
        set({ checklist })
      } catch {
        // Best effort
      }
      throw error
    }
  },

  applyTemplate: async (eventId: string, data: ApplyTemplateRequest) => {
    set({ isLoading: true, error: null })
    try {
      const checklist = await checklistService.applyTemplate(eventId, data)
      set({ checklist, isLoading: false })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to apply template'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  saveAsTemplate: async (eventId: string, data: SaveAsTemplateRequest) => {
    set({ error: null })
    try {
      const template = await checklistService.saveAsTemplate(eventId, data)
      set((state) => ({
        templates: [...state.templates, template],
      }))
      return template
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save template'
      set({ error: message })
      throw error
    }
  },

  fetchTemplates: async (npoId: string) => {
    set({ templatesLoading: true, error: null })
    try {
      const templates = await checklistService.listTemplates(npoId)
      set({ templates, templatesLoading: false })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch templates'
      set({ error: message, templatesLoading: false })
      throw error
    }
  },

  getTemplate: async (npoId: string, templateId: string) => {
    set({ error: null })
    try {
      const selectedTemplate = await checklistService.getTemplate(
        npoId,
        templateId
      )
      set({ selectedTemplate })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch template'
      set({ error: message })
      throw error
    }
  },

  updateTemplate: async (
    npoId: string,
    templateId: string,
    data: ChecklistTemplateUpdate
  ) => {
    set({ error: null })
    try {
      const updated = await checklistService.updateTemplate(
        npoId,
        templateId,
        data
      )
      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === templateId ? updated : t
        ),
      }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update template'
      set({ error: message })
      throw error
    }
  },

  deleteTemplate: async (npoId: string, templateId: string) => {
    set({ error: null })
    try {
      await checklistService.deleteTemplate(npoId, templateId)
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== templateId),
        selectedTemplate:
          state.selectedTemplate?.id === templateId
            ? null
            : state.selectedTemplate,
      }))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete template'
      set({ error: message })
      throw error
    }
  },

  setDefaultTemplate: async (npoId: string, templateId: string) => {
    set({ error: null })
    try {
      const updated = await checklistService.setDefaultTemplate(
        npoId,
        templateId
      )
      set((state) => ({
        templates: state.templates.map((t) => ({
          ...t,
          is_default: t.id === templateId ? updated.is_default : false,
        })),
      }))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to set default template'
      set({ error: message })
      throw error
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}))
