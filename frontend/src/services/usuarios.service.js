import api from './api'

export const usuariosService = {
  getAll: (params = {}) => api.get('/usuarios/', { params }),
  getById: (id) => api.get(`/usuarios/${id}/`),
  create: (data) => api.post('/usuarios/', data),
  update: (id, data) => api.patch(`/usuarios/${id}/`, data),
  delete: (id) => api.delete(`/usuarios/${id}/`),
  setPassword: (id, password) => api.post(`/usuarios/${id}/set-password/`, { password }),
}
