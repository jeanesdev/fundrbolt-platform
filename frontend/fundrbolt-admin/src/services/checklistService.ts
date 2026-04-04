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
import apiClient from '@/lib/axios'

class ChecklistService {
  async getEventChecklist(eventId: string): Promise<ChecklistResponse> {
    const response = await apiClient.get<ChecklistResponse>(
      `/admin/events/${eventId}/checklist`
    )
    return response.data
  }

  async createItem(
    eventId: string,
    data: ChecklistItemCreate
  ): Promise<ChecklistItem> {
    const response = await apiClient.post<ChecklistItem>(
      `/admin/events/${eventId}/checklist`,
      data
    )
    return response.data
  }

  async updateItem(
    eventId: string,
    itemId: string,
    data: ChecklistItemUpdate
  ): Promise<ChecklistItem> {
    const response = await apiClient.patch<ChecklistItem>(
      `/admin/events/${eventId}/checklist/${itemId}`,
      data
    )
    return response.data
  }

  async updateItemStatus(
    eventId: string,
    itemId: string,
    data: ChecklistItemStatusUpdate
  ): Promise<ChecklistItem> {
    const response = await apiClient.patch<ChecklistItem>(
      `/admin/events/${eventId}/checklist/${itemId}/status`,
      data
    )
    return response.data
  }

  async deleteItem(eventId: string, itemId: string): Promise<void> {
    await apiClient.delete(`/admin/events/${eventId}/checklist/${itemId}`)
  }

  async reorderItems(
    eventId: string,
    data: ChecklistReorderRequest
  ): Promise<ChecklistResponse> {
    const response = await apiClient.patch<ChecklistResponse>(
      `/admin/events/${eventId}/checklist/reorder`,
      data
    )
    return response.data
  }

  async applyTemplate(
    eventId: string,
    data: ApplyTemplateRequest
  ): Promise<ChecklistResponse> {
    const response = await apiClient.post<ChecklistResponse>(
      `/admin/events/${eventId}/checklist/apply-template`,
      data
    )
    return response.data
  }

  async saveAsTemplate(
    eventId: string,
    data: SaveAsTemplateRequest
  ): Promise<ChecklistTemplate> {
    const response = await apiClient.post<ChecklistTemplate>(
      `/admin/events/${eventId}/checklist/save-as-template`,
      data
    )
    return response.data
  }

  async listTemplates(npoId: string): Promise<ChecklistTemplate[]> {
    const response = await apiClient.get<ChecklistTemplate[]>(
      `/admin/npos/${npoId}/checklist-templates`
    )
    return response.data
  }

  async getTemplate(
    npoId: string,
    templateId: string
  ): Promise<ChecklistTemplateDetail> {
    const response = await apiClient.get<ChecklistTemplateDetail>(
      `/admin/npos/${npoId}/checklist-templates/${templateId}`
    )
    return response.data
  }

  async updateTemplate(
    npoId: string,
    templateId: string,
    data: ChecklistTemplateUpdate
  ): Promise<ChecklistTemplate> {
    const response = await apiClient.patch<ChecklistTemplate>(
      `/admin/npos/${npoId}/checklist-templates/${templateId}`,
      data
    )
    return response.data
  }

  async deleteTemplate(npoId: string, templateId: string): Promise<void> {
    await apiClient.delete(
      `/admin/npos/${npoId}/checklist-templates/${templateId}`
    )
  }

  async setDefaultTemplate(
    npoId: string,
    templateId: string
  ): Promise<ChecklistTemplate> {
    const response = await apiClient.post<ChecklistTemplate>(
      `/admin/npos/${npoId}/checklist-templates/${templateId}/set-default`
    )
    return response.data
  }
}

export default new ChecklistService()
