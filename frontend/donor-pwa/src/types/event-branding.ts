/**
 * TypeScript types for Event with Branding (Donor PWA Event Homepage)
 */

/**
 * Event with resolved branding for donor PWA.
 * Branding colors resolve with fallback chain: event → NPO → system defaults.
 */
export interface RegisteredEventWithBranding {
  // Identity
  id: string;
  name: string;
  slug: string;

  // Timing
  event_datetime: string; // ISO 8601 datetime
  timezone: string;
  is_past: boolean;
  is_upcoming: boolean; // True if event is within 30 days

  // Display
  thumbnail_url: string | null;

  // Branding (resolved: event → NPO → defaults)
  primary_color: string;
  secondary_color: string;
  background_color: string;
  accent_color: string;

  // NPO Info
  npo_name: string;
  npo_logo_url: string | null;
}

/**
 * Response containing list of events user is registered for.
 */
export interface RegisteredEventsResponse {
  events: RegisteredEventWithBranding[];
}

/**
 * Branding colors interface for CSS variable injection
 */
export interface EventBrandingColors {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  accent_color: string;
}
