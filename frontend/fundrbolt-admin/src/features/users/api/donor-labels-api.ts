import apiClient from '@/lib/axios'

export interface DonorLabel {
  id: string
  npo_id: string
  name: string
  color: string | null
  created_at: string
  updated_at: string
}

export interface DonorLabelListResponse {
  items: DonorLabel[]
}

export interface CreateDonorLabelRequest {
  name: string
  color?: string | null
}

export interface UpdateDonorLabelRequest {
  name?: string
  color?: string | null
}

export async function listDonorLabels(
  npoId: string
): Promise<DonorLabelListResponse> {
  const response = await apiClient.get<DonorLabelListResponse>(
    `/admin/npos/${npoId}/donor-labels`
  )
  return response.data
}

export async function createDonorLabel(
  npoId: string,
  data: CreateDonorLabelRequest
): Promise<DonorLabel> {
  const response = await apiClient.post<DonorLabel>(
    `/admin/npos/${npoId}/donor-labels`,
    data
  )
  return response.data
}

export async function updateDonorLabel(
  npoId: string,
  labelId: string,
  data: UpdateDonorLabelRequest
): Promise<DonorLabel> {
  const response = await apiClient.patch<DonorLabel>(
    `/admin/npos/${npoId}/donor-labels/${labelId}`,
    data
  )
  return response.data
}

export async function deleteDonorLabel(
  npoId: string,
  labelId: string
): Promise<void> {
  await apiClient.delete(`/admin/npos/${npoId}/donor-labels/${labelId}`)
}

export interface DonorLabelAssignmentInfo {
  id: string
  name: string
  color: string | null
}

export async function getUserDonorLabels(
  npoId: string,
  userId: string
): Promise<DonorLabelAssignmentInfo[]> {
  const response = await apiClient.get<DonorLabelAssignmentInfo[]>(
    `/admin/npos/${npoId}/donor-labels/users/${userId}`
  )
  return response.data
}

export async function setUserDonorLabels(
  npoId: string,
  userId: string,
  labelIds: string[]
): Promise<DonorLabelAssignmentInfo[]> {
  const response = await apiClient.put<DonorLabelAssignmentInfo[]>(
    `/admin/npos/${npoId}/donor-labels/users/${userId}`,
    { label_ids: labelIds }
  )
  return response.data
}
