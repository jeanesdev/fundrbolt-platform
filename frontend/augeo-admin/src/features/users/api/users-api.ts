import apiClient from '@/lib/axios'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  organization_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  role: string
  npo_id: string | null
  email_verified: boolean
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface UserListResponse {
  items: User[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface CreateUserRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  organization_name?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  role: string
  npo_id?: string
}

export interface UpdateUserRequest {
  first_name?: string
  last_name?: string
  phone?: string
  organization_name?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export interface RoleUpdateRequest {
  role: string
  npo_id?: string
}

export interface UserActivateRequest {
  is_active: boolean
}

/**
 * List users with pagination and filtering
 */
export async function listUsers(params?: {
  page?: number
  page_size?: number
  role?: string
  is_active?: boolean
}): Promise<UserListResponse> {
  const response = await apiClient.get<UserListResponse>('/users', { params })
  return response.data
}

/**
 * Get a single user by ID
 */
export async function getUser(userId: string): Promise<User> {
  const response = await apiClient.get<User>(`/users/${userId}`)
  return response.data
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserRequest): Promise<User> {
  const response = await apiClient.post<User>('/users', data)
  return response.data
}

/**
 * Update user information
 */
export async function updateUser(
  userId: string,
  data: UpdateUserRequest
): Promise<User> {
  const response = await apiClient.patch<User>(`/users/${userId}`, data)
  return response.data
}

/**
 * Update user role and NPO assignment
 */
export async function updateUserRole(
  userId: string,
  data: RoleUpdateRequest
): Promise<User> {
  const response = await apiClient.patch<User>(`/users/${userId}/role`, data)
  return response.data
}

/**
 * Activate or deactivate a user
 */
export async function activateUser(
  userId: string,
  data: UserActivateRequest
): Promise<User> {
  const response = await apiClient.post<User>(`/users/${userId}/activate`, data)
  return response.data
}

/**
 * Verify a user's email
 */
export async function verifyUserEmail(userId: string): Promise<User> {
  const response = await apiClient.post<User>(`/users/${userId}/verify-email`)
  return response.data
}

/**
 * Delete (deactivate) a user
 */
export async function deleteUser(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}`)
}
