export const GUEST_SESSION_COOKIE = 'guest_session_id'
export const GUEST_SESSION_TOKEN_COOKIE = 'guest_session_token'
export const GUEST_SESSION_STORAGE_KEY = 'caredesk_guest_session_id'
export const GUEST_SESSION_HEADER = 'x-guest-session-id'
export const GUEST_SESSION_TOKEN_HEADER = 'x-guest-session-token'

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isGuestSessionId(value: string | null | undefined): value is string {
  return Boolean(value && SESSION_ID_PATTERN.test(value))
}

export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return ''

  const existing = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY)
  if (isGuestSessionId(existing)) return existing

  const sessionId = window.crypto.randomUUID()
  window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, sessionId)
  return sessionId
}

export function saveGuestSessionId(sessionId: string): void {
  if (typeof window === 'undefined' || !isGuestSessionId(sessionId)) return
  window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, sessionId)
}

export function getGuestSessionHeaders(sessionId?: string): HeadersInit {
  const headers: Record<string, string> = {}
  const resolvedSessionId = sessionId || getOrCreateGuestSessionId()
  if (isGuestSessionId(resolvedSessionId)) {
    headers[GUEST_SESSION_HEADER] = resolvedSessionId
  }
  return headers
}
