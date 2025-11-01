/**
 * NPO (Non-Profit Organization) Zustand Store
 * Manages NPO state, members, applications, and branding
 */

import npoService from '@/services/npo-service'
import type {
  ApplicationListParams,
  ApplicationReviewRequest,
  BrandingCreateRequest,
  BrandingUpdateRequest,
  LogoUploadRequest,
  MemberAddRequest,
  MemberInviteRequest,
  MemberListParams,
  MemberRoleUpdateRequest,
  MemberStatusUpdateRequest,
  NPO,
  NPOApplication,
  NPOBranding,
  NPOCreateRequest,
  NPODetail,
  NPOListParams,
  NPOMember,
  NPOUpdateRequest,
} from '@/types/npo'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Helper function to extract error message from unknown error
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && 'response' in error && typeof error.response === 'object' && error.response !== null && 'data' in error.response && typeof error.response.data === 'object' && error.response.data !== null && 'detail' in error.response.data) {
    const detail = error.response.data.detail
    if (typeof detail === 'string') return detail
    if (typeof detail === 'object' && detail !== null && 'message' in detail && typeof detail.message === 'string') return detail.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}

interface NPOState {
  // Current NPO context
  currentNPO: NPODetail | null
  currentNPOId: string | null

  // NPO lists
  npos: NPO[]
  nposTotalCount: number
  nposLoading: boolean
  nposError: string | null

  // Applications
  applications: NPOApplication[]
  applicationsTotalCount: number
  applicationsLoading: boolean
  applicationsError: string | null

  // Members
  members: NPOMember[]
  membersTotalCount: number
  membersLoading: boolean
  membersError: string | null

  // Branding
  branding: NPOBranding | null
  brandingLoading: boolean
  brandingError: string | null

  // Actions - NPO Management
  setCurrentNPO: (npo: NPODetail | null) => void
  loadNPOs: (params?: NPOListParams) => Promise<void>
  loadNPOById: (npoId: string) => Promise<void>
  createNPO: (data: NPOCreateRequest) => Promise<NPO>
  updateNPO: (npoId: string, data: NPOUpdateRequest) => Promise<NPO>
  updateNPOStatus: (npoId: string, status: string, notes?: string) => Promise<NPO>
  deleteNPO: (npoId: string) => Promise<void>

  // Actions - Applications
  submitApplication: (npoId: string) => Promise<NPOApplication>
  loadApplications: (params?: ApplicationListParams) => Promise<void>
  reviewApplication: (
    applicationId: string,
    data: ApplicationReviewRequest
  ) => Promise<NPOApplication>

  // Actions - Members
  loadMembers: (params?: MemberListParams) => Promise<void>
  inviteMember: (npoId: string, data: MemberInviteRequest) => Promise<void>
  addMember: (npoId: string, data: MemberAddRequest) => Promise<NPOMember>
  updateMemberRole: (
    memberId: string,
    data: MemberRoleUpdateRequest
  ) => Promise<NPOMember>
  updateMemberStatus: (
    memberId: string,
    data: MemberStatusUpdateRequest
  ) => Promise<NPOMember>
  removeMember: (memberId: string, reason?: string) => Promise<void>

  // Actions - Branding
  loadBranding: (npoId: string) => Promise<void>
  createBranding: (npoId: string, data: BrandingCreateRequest) => Promise<NPOBranding>
  updateBranding: (npoId: string, data: BrandingUpdateRequest) => Promise<NPOBranding>
  uploadLogo: (npoId: string, file: File) => Promise<string>
  deleteLogo: (npoId: string) => Promise<void>

  // Actions - Reset
  reset: () => void
  resetErrors: () => void
}

export const useNPOStore = create<NPOState>()(
  persist(
    (set) => ({
      // Initial state
      currentNPO: null,
      currentNPOId: null,
      npos: [],
      nposTotalCount: 0,
      nposLoading: false,
      nposError: null,
      applications: [],
      applicationsTotalCount: 0,
      applicationsLoading: false,
      applicationsError: null,
      members: [],
      membersTotalCount: 0,
      membersLoading: false,
      membersError: null,
      branding: null,
      brandingLoading: false,
      brandingError: null,

      // ============================================
      // NPO Management Actions
      // ============================================

      setCurrentNPO: (npo) => {
        set({
          currentNPO: npo,
          currentNPOId: npo?.id || null,
        })
      },

      loadNPOs: async (params) => {
        set({ nposLoading: true, nposError: null })
        try {
          const response = await npoService.listNPOs(params)
          set({
            npos: response.items,
            nposTotalCount: response.total,
            nposLoading: false,
          })
        } catch (error: unknown) {
          set({
            nposError: getErrorMessage(error) || 'Failed to load NPOs',
            nposLoading: false,
          })
          throw error
        }
      },

      loadNPOById: async (npoId) => {
        set({ nposLoading: true, nposError: null })
        try {
          const npo = await npoService.getNPO(npoId)
          set({
            currentNPO: npo,
            currentNPOId: npo.id,
            nposLoading: false,
          })
        } catch (error: unknown) {
          set({
            nposError: getErrorMessage(error) || 'Failed to load NPO',
            nposLoading: false,
          })
          throw error
        }
      },

      createNPO: async (data) => {
        set({ nposLoading: true, nposError: null })
        try {
          const npo = await npoService.createNPO(data)
          // Optimistically add to list
          set((state) => ({
            npos: [npo, ...state.npos],
            nposTotalCount: state.nposTotalCount + 1,
            nposLoading: false,
          }))
          return npo
        } catch (error: unknown) {
          set({
            nposError: getErrorMessage(error) || 'Failed to create NPO',
            nposLoading: false,
          })
          throw error
        }
      },

      updateNPO: async (npoId, data) => {
        set({ nposLoading: true, nposError: null })
        try {
          const updatedNPO = await npoService.updateNPO(npoId, data)
          // Update in list
          set((state) => ({
            npos: state.npos.map((npo) =>
              npo.id === npoId ? updatedNPO : npo
            ),
            currentNPO:
              state.currentNPO?.id === npoId
                ? { ...state.currentNPO, ...updatedNPO }
                : state.currentNPO,
            nposLoading: false,
          }))
          return updatedNPO
        } catch (error: unknown) {
          set({
            nposError: getErrorMessage(error) || 'Failed to update NPO',
            nposLoading: false,
          })
          throw error
        }
      },

      updateNPOStatus: async (npoId, status, notes) => {
        set({ nposLoading: true, nposError: null })
        try {
          const updatedNPO = await npoService.updateNPOStatus(npoId, status, notes)
          // Update in list
          set((state) => ({
            npos: state.npos.map((npo) =>
              npo.id === npoId ? updatedNPO : npo
            ),
            currentNPO:
              state.currentNPO?.id === npoId
                ? { ...state.currentNPO, ...updatedNPO }
                : state.currentNPO,
            nposLoading: false,
          }))
          return updatedNPO
        } catch (error: unknown) {
          set({
            nposError: getErrorMessage(error) || 'Failed to update NPO status',
            nposLoading: false,
          })
          throw error
        }
      },

      deleteNPO: async (npoId) => {
        set({ nposLoading: true, nposError: null })
        try {
          await npoService.deleteNPO(npoId)
          // Remove from list
          set((state) => ({
            npos: state.npos.filter((npo) => npo.id !== npoId),
            nposTotalCount: state.nposTotalCount - 1,
            currentNPO: state.currentNPO?.id === npoId ? null : state.currentNPO,
            currentNPOId: state.currentNPOId === npoId ? null : state.currentNPOId,
            nposLoading: false,
          }))
        } catch (error: unknown) {
          set({
            nposError: getErrorMessage(error) || 'Failed to delete NPO',
            nposLoading: false,
          })
          throw error
        }
      },

      // ============================================
      // Application Management Actions
      // ============================================

      submitApplication: async (npoId) => {
        set({ applicationsLoading: true, applicationsError: null })
        try {
          const application = await npoService.application.submitApplication(npoId)
          // Add to list
          set((state) => ({
            applications: [application, ...state.applications],
            applicationsTotalCount: state.applicationsTotalCount + 1,
            applicationsLoading: false,
          }))
          return application
        } catch (error: unknown) {
          set({
            applicationsError:
              getErrorMessage(error) || 'Failed to submit application',
            applicationsLoading: false,
          })
          throw error
        }
      },

      loadApplications: async (params) => {
        set({ applicationsLoading: true, applicationsError: null })
        try {
          const response = await npoService.application.listApplications(params)
          set({
            applications: response.items,
            applicationsTotalCount: response.total,
            applicationsLoading: false,
          })
        } catch (error: unknown) {
          set({
            applicationsError:
              getErrorMessage(error) || 'Failed to load applications',
            applicationsLoading: false,
          })
          throw error
        }
      },

      reviewApplication: async (applicationId, data) => {
        set({ applicationsLoading: true, applicationsError: null })
        try {
          const updatedApp = await npoService.application.reviewApplication(
            applicationId,
            data
          )
          // Update in list
          set((state) => ({
            applications: state.applications.map((app) =>
              app.id === applicationId ? updatedApp : app
            ),
            applicationsLoading: false,
          }))
          return updatedApp
        } catch (error: unknown) {
          set({
            applicationsError:
              getErrorMessage(error) || 'Failed to review application',
            applicationsLoading: false,
          })
          throw error
        }
      },

      // ============================================
      // Member Management Actions
      // ============================================

      loadMembers: async (params) => {
        set({ membersLoading: true, membersError: null })
        try {
          const response = await npoService.member.listMembers(params)
          set({
            members: response.items,
            membersTotalCount: response.total,
            membersLoading: false,
          })
        } catch (error: unknown) {
          set({
            membersError:
              getErrorMessage(error) || 'Failed to load members',
            membersLoading: false,
          })
          throw error
        }
      },

      inviteMember: async (npoId, data) => {
        set({ membersLoading: true, membersError: null })
        try {
          await npoService.member.inviteMember(npoId, data)
          set({ membersLoading: false })
          // Note: Member won't be in list until they accept invitation
        } catch (error: unknown) {
          set({
            membersError:
              getErrorMessage(error) || 'Failed to invite member',
            membersLoading: false,
          })
          throw error
        }
      },

      addMember: async (npoId, data) => {
        set({ membersLoading: true, membersError: null })
        try {
          const member = await npoService.member.addMember(npoId, data)
          // Add to list
          set((state) => ({
            members: [member, ...state.members],
            membersTotalCount: state.membersTotalCount + 1,
            membersLoading: false,
          }))
          return member
        } catch (error: unknown) {
          set({
            membersError:
              getErrorMessage(error) || 'Failed to add member',
            membersLoading: false,
          })
          throw error
        }
      },

      updateMemberRole: async (memberId, data) => {
        set({ membersLoading: true, membersError: null })
        try {
          const updatedMember = await npoService.member.updateMemberRole(
            memberId,
            data
          )
          // Update in list
          set((state) => ({
            members: state.members.map((member) =>
              member.id === memberId ? updatedMember : member
            ),
            membersLoading: false,
          }))
          return updatedMember
        } catch (error: unknown) {
          set({
            membersError:
              getErrorMessage(error) || 'Failed to update member role',
            membersLoading: false,
          })
          throw error
        }
      },

      updateMemberStatus: async (memberId, data) => {
        set({ membersLoading: true, membersError: null })
        try {
          const updatedMember = await npoService.member.updateMemberStatus(
            memberId,
            data
          )
          // Update in list
          set((state) => ({
            members: state.members.map((member) =>
              member.id === memberId ? updatedMember : member
            ),
            membersLoading: false,
          }))
          return updatedMember
        } catch (error: unknown) {
          set({
            membersError:
              getErrorMessage(error) || 'Failed to update member status',
            membersLoading: false,
          })
          throw error
        }
      },

      removeMember: async (memberId, reason) => {
        set({ membersLoading: true, membersError: null })
        try {
          await npoService.member.removeMember(memberId, reason)
          // Remove from list
          set((state) => ({
            members: state.members.filter((member) => member.id !== memberId),
            membersTotalCount: state.membersTotalCount - 1,
            membersLoading: false,
          }))
        } catch (error: unknown) {
          set({
            membersError:
              getErrorMessage(error) || 'Failed to remove member',
            membersLoading: false,
          })
          throw error
        }
      },

      // ============================================
      // Branding Management Actions
      // ============================================

      loadBranding: async (npoId) => {
        set({ brandingLoading: true, brandingError: null })
        try {
          const branding = await npoService.branding.getBranding(npoId)
          set({
            branding,
            brandingLoading: false,
          })
        } catch (error: unknown) {
          set({
            brandingError:
              getErrorMessage(error) || 'Failed to load branding',
            brandingLoading: false,
          })
          throw error
        }
      },

      createBranding: async (npoId, data) => {
        set({ brandingLoading: true, brandingError: null })
        try {
          const branding = await npoService.branding.createBranding(npoId, data)
          set({
            branding,
            brandingLoading: false,
          })
          return branding
        } catch (error: unknown) {
          set({
            brandingError:
              getErrorMessage(error) || 'Failed to create branding',
            brandingLoading: false,
          })
          throw error
        }
      },

      updateBranding: async (npoId, data) => {
        set({ brandingLoading: true, brandingError: null })
        try {
          const branding = await npoService.branding.updateBranding(npoId, data)
          set({
            branding,
            brandingLoading: false,
          })
          return branding
        } catch (error: unknown) {
          set({
            brandingError:
              getErrorMessage(error) || 'Failed to update branding',
            brandingLoading: false,
          })
          throw error
        }
      },

      uploadLogo: async (npoId, file) => {
        set({ brandingLoading: true, brandingError: null })
        try {
          // Step 1: Request upload URL
          const uploadData: LogoUploadRequest = {
            file_name: file.name,
            content_type: file.type,
            file_size: file.size,
          }
          const { upload_url, logo_url } = await npoService.branding.requestLogoUpload(
            npoId,
            uploadData
          )

          // Step 2: Upload file to Azure Blob Storage
          await npoService.branding.uploadLogoFile(upload_url, file)

          // Step 3: Update branding state with new logo URL
          set((state) => ({
            branding: state.branding
              ? { ...state.branding, logo_url }
              : null,
            brandingLoading: false,
          }))

          return logo_url
        } catch (error: unknown) {
          set({
            brandingError:
              getErrorMessage(error) || 'Failed to upload logo',
            brandingLoading: false,
          })
          throw error
        }
      },

      deleteLogo: async (npoId) => {
        set({ brandingLoading: true, brandingError: null })
        try {
          await npoService.branding.deleteLogo(npoId)
          // Clear logo URL from branding
          set((state) => ({
            branding: state.branding
              ? { ...state.branding, logo_url: null }
              : null,
            brandingLoading: false,
          }))
        } catch (error: unknown) {
          set({
            brandingError:
              getErrorMessage(error) || 'Failed to delete logo',
            brandingLoading: false,
          })
          throw error
        }
      },

      // ============================================
      // Reset Actions
      // ============================================

      reset: () => {
        set({
          currentNPO: null,
          currentNPOId: null,
          npos: [],
          nposTotalCount: 0,
          nposLoading: false,
          nposError: null,
          applications: [],
          applicationsTotalCount: 0,
          applicationsLoading: false,
          applicationsError: null,
          members: [],
          membersTotalCount: 0,
          membersLoading: false,
          membersError: null,
          branding: null,
          brandingLoading: false,
          brandingError: null,
        })
      },

      resetErrors: () => {
        set({
          nposError: null,
          applicationsError: null,
          membersError: null,
          brandingError: null,
        })
      },
    }),
    {
      name: 'npo-store',
      // Only persist current NPO context, not full lists
      partialize: (state) => ({
        currentNPO: state.currentNPO,
        currentNPOId: state.currentNPOId,
      }),
    }
  )
)

export default useNPOStore
