import api from './api'

export const authService = {
  login: (credentials) => api.post('/auth/login/', credentials),
  refresh: (refresh) => api.post('/auth/refresh/', { refresh }),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  me: () => api.get('/auth/me/'),
}
