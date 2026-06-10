import api from './api'

export const garantiasService = {
  getAll: (params = {}) => api.get('/garantias/', { params }),
  getById: (id) => api.get(`/garantias/${id}/`),
  actualizarVencidas: () => api.post('/garantias/actualizar_vencidas/'),
}
