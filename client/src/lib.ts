import axios from 'axios'
export const api = axios.create({ baseURL: '/api/v1', headers: { 'Content-Type': 'application/json' } })
export function setToken(token: string) {
  localStorage.setItem('noteora_token', token)
  api.defaults.headers.common.Authorization = 'Bearer ' + token
}
const token = localStorage.getItem('noteora_token')
if (token) setToken(token)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && location.pathname.startsWith('/admin')) {
      localStorage.removeItem('noteora_token')
      delete api.defaults.headers.common.Authorization
      location.href = '/login?reason=session-expired'
    }
    return Promise.reject(error)
  }
)
