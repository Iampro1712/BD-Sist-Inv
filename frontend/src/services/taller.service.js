import api from './api'

export const tallerService = {
  // Órdenes de trabajo
  getAll: (params = {}) => api.get('/servicios-motos/', { params }),
  get: (id) => api.get(`/servicios-motos/${id}/`),
  agendar: (data) => api.post('/servicios-motos/', data),
  update: (id, data) => api.patch(`/servicios-motos/${id}/`, data),
  remove: (id) => api.delete(`/servicios-motos/${id}/`),

  // Ciclo de vida
  cambiarEstado: (id, data) => api.post(`/servicios-motos/${id}/cambiar-estado/`, data),
  entregar: (id, data = {}) => api.post(`/servicios-motos/${id}/entregar/`, data),

  // Presupuesto de reparación (no toca stock hasta que el cliente aprueba)
  presupuestar: (id, data) => api.post(`/servicios-motos/${id}/presupuestar/`, data),

  // Repuestos consumidos (descuentan stock)
  agregarRepuesto: (id, data) => api.post(`/servicios-motos/${id}/agregar-repuesto/`, data),
  eliminarRepuesto: (id, repuestoId) =>
    api.delete(`/servicios-motos/${id}/eliminar-repuesto/${repuestoId}/`),

  // Motos del cliente seleccionado (para agendar)
  getMotos: (params = {}) => api.get('/motos/', { params }),

  // Catálogo de tipos de servicio
  getCatalogo: (params = {}) => api.get('/servicios/', { params }),
  crearTipoServicio: (data) => api.post('/servicios/', data),
  actualizarTipoServicio: (id, data) => api.put(`/servicios/${id}/`, data),
  eliminarTipoServicio: (id) => api.delete(`/servicios/${id}/`),

  // Reportes
  getAgenda: () => api.get('/reportes/agenda-taller/'),
  getPreventivo: () => api.get('/reportes/mantenimiento-preventivo/'),
}
