import apiClient from '@/lib/axios'

export interface DonorSurveyOption {
  id: string
  text: string
  display_order: number
  is_other: boolean
}

export interface DonorSurveyQuestion {
  id: string
  text: string
  display_order: number
  is_active: boolean
  options: DonorSurveyOption[]
}

export interface DonorSurveyConfig {
  id: string
  event_id: string
  is_active: boolean
  modal_prompt_title: string
  modal_prompt_body: string
  discount_cents: number
  questions: DonorSurveyQuestion[]
}

export interface DonorSurveyStatusResponse {
  should_show: boolean
  survey: DonorSurveyConfig | null
}

export interface DonorSurveySubmitResponse {
  status: string
  discount_cents_applied: number
  suggested_label_ids: string[]
}

export async function getDonorSurveyStatus(
  eventId: string
): Promise<DonorSurveyStatusResponse> {
  const response = await apiClient.get<DonorSurveyStatusResponse>(
    `/donor/events/${eventId}/survey/status`
  )
  return response.data
}

export async function submitDonorSurvey(
  eventId: string,
  payload:
    | { action: 'skip'; answers?: [] }
    | {
        action: 'complete'
        answers: Array<{
          question_id: string
          option_id: string
          other_text?: string | null
        }>
      }
): Promise<DonorSurveySubmitResponse> {
  const response = await apiClient.post<DonorSurveySubmitResponse>(
    `/donor/events/${eventId}/survey/response`,
    payload
  )
  return response.data
}
