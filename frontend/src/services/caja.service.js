import api from './api'

export const cajaService = {
  // Sesión de caja abierta actual (o null si no hay ninguna).
  getActual: () => api.get('/caja/actual/'),

  // Historial de sesiones (solo admin en el backend).
  getHistorial: (params = {}) => api.get('/caja/', { params }),

  getById: (id) => api.get(`/caja/${id}/`),

  abrir: (data) => api.post('/caja/abrir/', data),

  cerrar: (id, data) => api.post(`/caja/${id}/cerrar/`, data),

  getMovimientos: (id) => api.get(`/caja/${id}/movimientos/`),

  crearMovimiento: (id, data) => api.post(`/caja/${id}/movimientos/`, data),
}
