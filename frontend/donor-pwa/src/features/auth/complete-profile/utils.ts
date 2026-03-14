export function markProfileSetupSeen(userId: string): void {
  localStorage.setItem(`profile_setup_seen_${userId}`, '1')
}

export function hasSeenProfileSetup(userId: string): boolean {
  return !!localStorage.getItem(`profile_setup_seen_${userId}`)
}
