export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(ApiError.messageOf(body) ?? `Request failed with status ${status}`)
    this.status = status
    this.body = body
  }

  /** Nest returns `message` as a string or, for validation errors, a string array. */
  static messageOf(body: unknown): string | undefined {
    if (!body || typeof body !== 'object' || !('message' in body)) return undefined
    const { message } = body as { message: unknown }
    if (Array.isArray(message)) return message.join('\n')
    return typeof message === 'string' ? message : undefined
  }
}

/** Thrown when the request never reached the server (offline, DNS, aborted). */
export class NetworkError extends Error {}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      // Same-origin cookie auth; the browser adds the Origin header the API checks.
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : 'Network error')
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    // Non-JSON body (e.g. a proxy error page); keep the raw text.
  }
  if (!response.ok) throw new ApiError(response.status, data)
  return data as T
}
