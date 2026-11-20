/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
const ACCESS = 'tn_access', REFRESH = 'tn_refresh'

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.')
export const hasToken = () => !!ls.get(REFRESH)

function parseError(data: any, status: number): string {
  if (!data) return `요청에 실패했어요 (${status})`
  if (typeof data === 'string') return data
  if (data.detail) return String(data.detail)
  const first: any = Object.values(data)[0]
  const msg = Array.isArray(first) ? first[0] : first
  return typeof msg === 'string' ? msg : JSON.stringify(msg)
}

let refreshing: Promise<boolean> | null = null
function tryRefresh(): Promise<boolean> {
  const refresh = ls.get(REFRESH)
  if (!refresh) return Promise.resolve(false)
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }),
    })
      .then(async res => {
        if (!res.ok) return false
        const d = await res.json()
        ls.set(ACCESS, d.access)
        if (d.refresh) ls.set(REFRESH, d.refresh)
        return true
      })
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

export function clearSession() {
  ls.del(ACCESS); ls.del(REFRESH); ls.del('tn_active_trip')
  window.dispatchEvent(new Event('tn-logout'))
}

async function req<T = any>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const access = ls.get(ACCESS)
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없어요. 네트워크를 확인해 주세요.')
  }
  const isAuthCall = path.startsWith('/auth/login') || path.startsWith('/auth/register')
  if (res.status === 401 && !isAuthCall) {
    if (retry && (await tryRefresh())) return req<T>(method, path, body, false)
    clearSession()
    throw new ApiError(401, '로그인이 만료됐어요. 다시 로그인해 주세요.')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, parseError(data, res.status))
  return data as T
}

export const api = {
  get: <T = any>(p: string) => req<T>('GET', p),
  post: <T = any>(p: string, b?: unknown) => req<T>('POST', p, b ?? {}),
  patch: <T = any>(p: string, b: unknown) => req<T>('PATCH', p, b),
  del: (p: string) => req<void>('DELETE', p),
}

function saveTokens(d: { access: string; refresh: string }) { ls.set(ACCESS, d.access); ls.set(REFRESH, d.refresh) }

export async function login(email: string, password: string) {
  try {
    saveTokens(await req('POST', '/auth/login/', { email: email.trim().toLowerCase(), password }))
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw new ApiError(401, '이메일 또는 비밀번호가 올바르지 않아요.')
    throw e
  }
}
export async function register(email: string, password: string) {
  saveTokens(await req('POST', '/auth/register/', { email: email.trim().toLowerCase(), password }))
}
