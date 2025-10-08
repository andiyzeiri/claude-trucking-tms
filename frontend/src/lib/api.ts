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
    // Use both standard and custom header as workaround for browser restrictions
    config.headers.Authorization = `Bearer ${token}`
    config.headers['X-Auth-Token'] = token
  }

  // Add trailing slash if not present (FastAPI requires it)
  if (config.url && !config.url.endsWith('/') && !config.url.includes('?')) {
    config.url += '/'
  } else if (config.url && config.url.includes('?') && !config.url.match(/\/\?/)) {
    config.url = config.url.replace('?', '/?')
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
      // Remove invalid token
      Cookies.remove('auth-token')
      // Don't redirect automatically - let components handle it
    }
    return Promise.reject(error)
  }
)

export default api