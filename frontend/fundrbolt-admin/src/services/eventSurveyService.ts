import apiClient from '@/lib/axios'

export interface SurveyQuestionOption {
  id: string
  text: string
  display_order: number
  is_other: boolean
}

export interface SurveyQuestion {
  id: string
  text: string
  display_order: number
  is_active: boolean
  options: SurveyQuestionOption[]
}

export interface SurveyConfig {
  id: string
  event_id: string
  is_active: boolean
  modal_prompt_title: string
  modal_prompt_body: string
  discount_cents: number
  questions: SurveyQuestion[]
}

export interface SurveyConfigUpdateRequest {
  is_active?: boolean
  modal_prompt_title?: string
  modal_prompt_body?: string
  discount_cents?: number
}

export interface SurveyQuestionInput {
  id?: string
  text: string
  display_order: number
  is_active?: boolean
  options: Array<{
    id?: string
    text: string
    display_order: number
    is_other?: boolean
  }>
}

class EventSurveyService {
  async getSurvey(eventId: string) {
    const response = await apiClient.get<SurveyConfig>(
      `/admin/events/${eventId}/survey`
    )
    return response.data
  }

  async updateSurvey(eventId: string, data: SurveyConfigUpdateRequest) {
    const response = await apiClient.patch<SurveyConfig>(
      `/admin/events/${eventId}/survey`,
      data
    )
    return response.data
  }

  async resetDefaults(eventId: string) {
    const response = await apiClient.post<SurveyConfig>(
      `/admin/events/${eventId}/survey/reset-defaults`
    )
    return response.data
  }

  async copyFromEvent(eventId: string, sourceEventId: string) {
    const response = await apiClient.post<SurveyConfig>(
      `/admin/events/${eventId}/survey/copy-from/${sourceEventId}`
    )
    return response.data
  }

  async createQuestion(eventId: string, data: SurveyQuestionInput) {
    const response = await apiClient.post<SurveyQuestion>(
      `/admin/events/${eventId}/survey/questions`,
      data
    )
    return response.data
  }

  async updateQuestion(
    eventId: string,
    questionId: string,
    data: SurveyQuestionInput
  ) {
    const response = await apiClient.patch<SurveyQuestion>(
      `/admin/events/${eventId}/survey/questions/${questionId}`,
      data
    )
    return response.data
  }

  async deleteQuestion(eventId: string, questionId: string) {
    await apiClient.delete(
      `/admin/events/${eventId}/survey/questions/${questionId}`
    )
  }
}

export const eventSurveyService = new EventSurveyService()
