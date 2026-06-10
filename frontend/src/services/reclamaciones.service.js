import api from './api'

export const reclamacionesService = {
  getAll: (params = {}) => api.get('/reclamaciones/', { params }),
  getById: (id) => api.get(`/reclamaciones/${id}/`),
  create: (data) => api.post('/reclamaciones/', data),
  resolver: (id, resolucion) => api.post(`/reclamaciones/${id}/resolver/`, { resolucion }),
}
