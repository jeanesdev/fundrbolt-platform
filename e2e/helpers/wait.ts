import type { ApiClient } from './api-client'

export async function waitForCondition(
  conditionFn: () => Promise<boolean>,
  opts: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const timeout = opts.timeout ?? 10_000
  const interval = opts.interval ?? 250
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await conditionFn()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(opts.message ?? 'Timed out waiting for condition')
}

export async function waitForApiState<T>(
  apiClient: ApiClient,
  endpoint: string,
  assertFn: (data: T) => boolean,
  opts?: { timeout?: number; interval?: number; message?: string }
): Promise<T> {
  let lastValue: T | undefined
  await waitForCondition(async () => {
    lastValue = await apiClient.get<T>(endpoint)
    return assertFn(lastValue)
  }, opts)
  return lastValue as T
}
