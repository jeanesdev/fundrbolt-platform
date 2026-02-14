import apiClient from '@/lib/axios'
import type { RegistrationImportReport } from '@/types/registrationImport'

/**
 * Registration Import Service
 * Handles registration bulk import API calls (preflight and commit)
 */
class RegistrationImportService {
  /**
   * Preflight a bulk import file for registrations (JSON, CSV, or Excel)
   * Validates the file without creating any records
   */
  async preflightImport(
    eventId: string,
    file: File
  ): Promise<RegistrationImportReport> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<RegistrationImportReport>(
      `/admin/events/${eventId}/registrations/import/preflight`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data
  }

  /**
   * Commit a bulk import file for registrations
   * Creates registration records for valid rows
   */
  async commitImport(
    eventId: string,
    file: File
  ): Promise<RegistrationImportReport> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<RegistrationImportReport>(
      `/admin/events/${eventId}/registrations/import/commit`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data
  }
}

export const registrationImportService = new RegistrationImportService()
export default registrationImportService
