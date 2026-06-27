import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 segundos timeout para subida de imágenes
})

// Claves de tokens en localStorage (mismas que useAuthStore)
const ACCESS = 'auth_access'
const REFRESH = 'auth_refresh'

// Request interceptor: adjunta el token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS)
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Refresh dedupe: una sola petición de refresh aunque varias 401 lleguen juntas
let refreshingPromise = null

const refrescarToken = async () => {
  const refresh = localStorage.getItem(REFRESH)
  if (!refresh) throw new Error('Sin refresh token')
  // axios "crudo" para no pasar por estos interceptores
  const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh })
  localStorage.setItem(ACCESS, data.access)
  if (data.refresh) localStorage.setItem(REFRESH, data.refresh) // rotación
  return data.access
}

const forzarLogout = () => {
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
  localStorage.removeItem('auth_user')
  if (window.location.pathname !== '/login') window.location.href = '/login'
}

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    // Ignorar errores de cancelación
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      console.log('Request canceled:', error.message)
      return Promise.reject({ canceled: true })
    }

    // 401: intentar UN refresh y reintentar la petición original
    const original = error.config
    const reqUrl = String(original?.url || '')
    if (
      error.response?.status === 401 &&
      original && !original._retry &&
      !reqUrl.includes('/auth/login') && !reqUrl.includes('/auth/refresh')
    ) {
      original._retry = true
      try {
        if (!refreshingPromise) {
          refreshingPromise = refrescarToken().finally(() => { refreshingPromise = null })
        }
        const nuevoAccess = await refreshingPromise
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${nuevoAccess}`
        return api(original)
      } catch {
        forzarLogout()
        return Promise.reject(error)
      }
    }

    // Handle errors globally
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response

      switch (status) {
        case 400:
          console.error('Bad Request:', data)
          break
        case 401:
        case 403:
          // Errores de autenticación/permiso: los maneja la UI (login/guards).
          // No se loguean para no ensuciar la consola con datos del servidor.
          break
        case 404:
          console.error('Not Found:', data)
          break
        case 500:
          console.error('Server Error:', data)
          break
        case 503:
          console.error('Service Unavailable:', data)
          break
        default:
          console.error('Error:', data)
      }
    } else if (error.request) {
      // No response from server
      console.error('Network Error: No response from server')
    } else {
      // Error in request configuration
      console.error('Request Error:', error.message)
    }

    return Promise.reject(error)
  }
)

/**
 * Helper para crear requests cancelables
 */
export const createCancelableRequest = () => {
  const controller = new AbortController()

  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  }
}

export default api
