import { create } from 'zustand'

interface RunOfShowStore {
  isTemplateModalOpen: boolean
  openTemplateModal: () => void
  closeTemplateModal: () => void
  isSaveTemplateDialogOpen: boolean
  openSaveTemplateDialog: () => void
  closeSaveTemplateDialog: () => void
}

export const useRunOfShowStore = create<RunOfShowStore>((set) => ({
  isTemplateModalOpen: false,
  openTemplateModal: () => set({ isTemplateModalOpen: true }),
  closeTemplateModal: () => set({ isTemplateModalOpen: false }),
  isSaveTemplateDialogOpen: false,
  openSaveTemplateDialog: () => set({ isSaveTemplateDialogOpen: true }),
  closeSaveTemplateDialog: () => set({ isSaveTemplateDialogOpen: false }),
}))
