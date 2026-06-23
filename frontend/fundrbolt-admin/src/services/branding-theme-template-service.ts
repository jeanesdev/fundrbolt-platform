import type {
  BrandingThemeTemplate,
  BrandingThemeTemplateCreateRequest,
  BrandingThemeTemplateUpdateRequest,
} from '@/types/event'
import apiClient from '@/lib/axios'

export const brandingThemeTemplateApi = {
  async list(): Promise<BrandingThemeTemplate[]> {
    const response = await apiClient.get<BrandingThemeTemplate[]>(
      '/admin/branding-theme-templates'
    )
    return response.data
  },

  async create(
    payload: BrandingThemeTemplateCreateRequest
  ): Promise<BrandingThemeTemplate> {
    const response = await apiClient.post<BrandingThemeTemplate>(
      '/admin/branding-theme-templates',
      payload
    )
    return response.data
  },

  async update(
    templateId: string,
    payload: BrandingThemeTemplateUpdateRequest
  ): Promise<BrandingThemeTemplate> {
    const response = await apiClient.patch<BrandingThemeTemplate>(
      `/admin/branding-theme-templates/${templateId}`,
      payload
    )
    return response.data
  },
}
