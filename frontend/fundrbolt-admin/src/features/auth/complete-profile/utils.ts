/**
 * Helpers for tracking whether the user has seen the first-time profile
 * completion prompt.
 *
 * Stored in localStorage as `profile_setup_seen_<userId>` so users are
 * only prompted once per device / browser.
 */

export function markProfileSetupSeen(userId: string): void {
  localStorage.setItem(`profile_setup_seen_${userId}`, '1')
}

export function hasSeenProfileSetup(userId: string): boolean {
  return !!localStorage.getItem(`profile_setup_seen_${userId}`)
}
