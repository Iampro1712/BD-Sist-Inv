import api from './api'

export const devolucionesService = {
  getAll:  (params = {}) => api.get('/devoluciones/', { params }),
  getById: (id)          => api.get(`/devoluciones/${id}/`),
  create:  (data)        => api.post('/devoluciones/', data),
}
