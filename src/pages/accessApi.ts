type Session = { accessToken: string; refreshToken: string }
export type AccessSession = Session
export type AccessResult = { url: string }

const SESSION_KEY = 'shortlink-session'
const API_KEY = 'shortlink-api'

export function readAccessSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveAccessSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export async function accessRequest<T>(
  path: string,
  options: RequestInit = {},
  session = readAccessSession(),
): Promise<T> {
  const apiBase = (localStorage.getItem(API_KEY) || '/api').replace(/\/$/, '')
  const send = (token?: string) => {
    const headers = new Headers(options.headers)
    if (options.body && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${apiBase}${path}`, { ...options, headers })
  }

  let response = await send(session?.accessToken)
  const isPublicAuth = ['/auth/login', '/auth/refresh'].includes(path)
  if (response.status === 401 && session?.refreshToken && !isPublicAuth) {
    try {
      const refreshed = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      })
      if (!refreshed.ok) throw new Error('登录状态已过期，请重新登录。')
      const nextSession = (await refreshed.json()) as Session
      saveAccessSession(nextSession)
      response = await send(nextSession.accessToken)
    } catch (cause) {
      localStorage.removeItem(SESSION_KEY)
      throw cause instanceof Error ? cause : new Error('登录状态已过期，请重新登录。')
    }
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[]
    } | null
    const message = Array.isArray(payload?.message) ? payload.message.join('；') : payload?.message
    throw new Error(message || `请求失败 (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
