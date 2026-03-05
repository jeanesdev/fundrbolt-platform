// Stub module for virtual:pwa-register/react so Vite can resolve the import.
// The actual mock implementation is provided by vi.mock() in each test file.
export function useRegisterSW() {
  return {
    offlineReady: [false, () => { }] as const,
    needRefresh: [false, () => { }] as const,
    updateServiceWorker: async () => { },
  }
}
