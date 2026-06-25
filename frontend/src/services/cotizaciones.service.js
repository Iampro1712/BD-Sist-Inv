import api from './api'

export const cotizacionesService = {
  getAll:  (params = {}) => api.get('/cotizaciones/', { params }),
  getById: (id)          => api.get(`/cotizaciones/${id}/`),
  create:  (data)        => api.post('/cotizaciones/', data),
  delete:  (id)          => api.delete(`/cotizaciones/${id}/`),

  convertirVenta: (id)         => api.post(`/cotizaciones/${id}/convertir-venta/`),
  cambiarEstado:  (id, estado) => api.post(`/cotizaciones/${id}/cambiar_estado/`, { estado }),
}
