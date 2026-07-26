import api from './api'

export const ubicacionesService = {
  getAll: (params = {}) => api.get('/ubicaciones/', { params }),
  get: (id) => api.get(`/ubicaciones/${id}/`),
  create: (data) => api.post('/ubicaciones/', data),
  update: (id, data) => api.put(`/ubicaciones/${id}/`, data),
  remove: (id) => api.delete(`/ubicaciones/${id}/`),

  // Qué hay guardado en un lugar
  productos: (id) => api.get(`/ubicaciones/${id}/productos/`),
  // Bodegas existentes, para poblar filtros
  bodegas: () => api.get('/ubicaciones/bodegas/'),

  // Asignación masiva desde el listado de productos
  asignar: (data) => api.post('/productos/asignar-ubicacion/', data),

  // Conteo físico
  getConteo: (params = {}) => api.get('/reportes/conteo-fisico/', { params }),
  aplicarConteo: (data) => api.post('/movimientos/aplicar-conteo/', data),
}
