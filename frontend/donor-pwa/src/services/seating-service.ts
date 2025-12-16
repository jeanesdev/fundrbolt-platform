/**
 * Seating Service (T081)
 *
 * API service for donor seating information.
 */

import apiClient from '@/lib/axios';

export interface MySeatingInfo {
  guestId: string;
  fullName: string | null;
  bidderNumber: number | null;
  tableNumber: number | null;
  checkedIn: boolean;
}

export interface TablemateInfo {
  guestId: string;
  name: string | null;
  bidderNumber: number | null;
  company?: string | null;
  profileImageUrl?: string | null;
}

export interface SeatingInfoResponse {
  myInfo: MySeatingInfo;
  tablemates: TablemateInfo[];
  tableCapacity: {
    current: number;
    max: number;
  };
  hasTableAssignment: boolean;
  message?: string | null;
}

/**
 * Get current user's seating information for an event.
 *
 * @param eventId - Event UUID
 * @returns Promise<SeatingInfoResponse>
 * @throws Error if user has no registration for event
 */
export const getMySeatingInfo = async (
  eventId: string
): Promise<SeatingInfoResponse> => {
  const response = await apiClient.get<SeatingInfoResponse>(
    `/donor/events/${eventId}/my-seating`
  );
  return response.data;
};
