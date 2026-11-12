import axios from 'axios'
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true, headers: { 'Content-Type': 'application/json', 'X-Noteora-CSRF': '1' } })
// Access tokens stay in this tab; refresh tokens are HttpOnly cookies.
localStorage.removeItem('noteora_token')
export function clearToken() {
  sessionStorage.removeItem('noteora_token')
  delete api.defaults.headers.common.Authorization
}
export function setToken(token: string) {
  sessionStorage.setItem('noteora_token', token)
  api.defaults.headers.common.Authorization = 'Bearer ' + token
}
const token = sessionStorage.getItem('noteora_token')
if (token) setToken(token)
let pendingRefresh: Promise<void> | null = null
export function restoreSession(): Promise<void> {
  if (!pendingRefresh) {
    const refresh = async () => {
      const response = await api.post('/auth/refresh')
      setToken(response.data.accessToken)
    }
    // Serialize shared-cookie rotation across same-origin browser tabs.
    pendingRefresh = (navigator.locks ? navigator.locks.request('noteora-refresh', refresh) : refresh()).then(() => undefined)
      .catch(error => { clearToken(); throw error }).finally(() => { pendingRefresh = null })
  }
  return pendingRefresh!
}
export async function logoutSession(all = false) {
  try { await restoreSession() } catch (error: any) { if (error.response?.status === 401) { clearToken(); return }; throw error }
  await api.post(all ? '/auth/logout-all' : '/auth/logout')
  clearToken()
}
api.interceptors.response.use(response => response, async error => {
  const config = error.config
  if (error.response?.status === 401 && config && !config._sessionRetried && !config.url?.startsWith('/auth/')) {
    config._sessionRetried = true
    try {
      await restoreSession()
      config.headers.Authorization = api.defaults.headers.common.Authorization
      return await api.request(config)
    } catch { clearToken() }
  }
  return Promise.reject(error)
})
