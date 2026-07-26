import api from './api'

export const gastosService = {
  // Gastos
  getAll: (params = {}) => api.get('/gastos/', { params }),
  create: (data) => api.post('/gastos/', data),
  update: (id, data) => api.put(`/gastos/${id}/`, data),
  remove: (id) => api.delete(`/gastos/${id}/`),

  // Categorías de gasto
  getCategorias: (params = {}) => api.get('/categorias-gasto/', { params }),
  crearCategoria: (data) => api.post('/categorias-gasto/', data),
  actualizarCategoria: (id, data) => api.put(`/categorias-gasto/${id}/`, data),
  eliminarCategoria: (id) => api.delete(`/categorias-gasto/${id}/`),

  // Estado de resultados (P&L)
  getEstadoResultados: (params = {}) => api.get('/reportes/estado-resultados/', { params }),
}
