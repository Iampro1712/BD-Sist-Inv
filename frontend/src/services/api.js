import axios from 'axios'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos timeout
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add auth tokens here if needed in the future
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Ignorar errores de cancelación
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      console.log('Request canceled:', error.message)
      return Promise.reject({ canceled: true })
    }

    // Handle errors globally
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response

      switch (status) {
        case 400:
          console.error('Bad Request:', data)
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
