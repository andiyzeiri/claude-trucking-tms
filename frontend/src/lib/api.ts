import axios from 'axios'
import Cookies from 'js-cookie'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// Debug log to verify API URL configuration
if (typeof window !== 'undefined') {
  console.log('[API Config] Using baseURL:', API_BASE_URL)
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('auth-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (typeof window !== 'undefined') {
    console.log('[API Request]', config.method?.toUpperCase(), config.url, 'baseURL:', config.baseURL, 'token:', token ? 'present' : 'MISSING')
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only remove token if it's explicitly an auth error (not network issues)
      if (error.config && !error.config._retry) {
        console.log('[API] 401 Unauthorized - keeping token for now')
        // Mark this request as retried to avoid infinite loops
        error.config._retry = true
      }
      // Let components handle redirecting to login if needed
    }
    return Promise.reject(error)
  }
)

export default api