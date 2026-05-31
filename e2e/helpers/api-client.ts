export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string
  ) {}

  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }
}

export function createApiClient(baseUrl: string, token?: string): ApiClient {
  return new ApiClient(baseUrl, token)
}
