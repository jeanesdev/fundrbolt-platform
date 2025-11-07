/**
 * API client configuration and types.
 */

import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface ContactSubmission {
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
}

export interface ContactSubmissionResponse {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: 'pending' | 'processed' | 'failed';
  created_at: string;
}

export interface Testimonial {
  id: string;
  quote_text: string;
  author_name: string;
  author_role: 'donor' | 'auctioneer' | 'npo_admin';
  organization_name: string | null;
  photo_url: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
}

// API methods
export const contactApi = {
  submit: async (data: ContactSubmission): Promise<ContactSubmissionResponse> => {
    const response = await api.post<ContactSubmissionResponse>('/public/contact/submit', data);
    return response.data;
  },
};

export const testimonialApi = {
  list: async (params?: { limit?: number; offset?: number; role?: string }): Promise<Testimonial[]> => {
    const response = await api.get<Testimonial[]>('/public/testimonials', { params });
    return response.data;
  },
};
