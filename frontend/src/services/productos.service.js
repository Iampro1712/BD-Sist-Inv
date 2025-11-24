import api from './api'

export const productosService = {
  // Get all productos
  getAll: (params = {}) => {
    return api.get('/productos/', { params })
  },

  // Get single producto
  getById: (id) => {
    return api.get(`/productos/${id}/`)
  },

  // Create producto
  create: (data) => {
    return api.post('/productos/', data)
  },

  // Update producto
  update: (id, data) => {
    return api.put(`/productos/${id}/`, data)
  },

  // Partial update
  partialUpdate: (id, data) => {
    return api.patch(`/productos/${id}/`, data)
  },

  // Delete producto
  delete: (id) => {
    return api.delete(`/productos/${id}/`)
  },

  // Get productos with low stock
  getStockBajo: () => {
    return api.get('/productos/stock-bajo/')
  },

  // Get movimientos of producto
  getMovimientos: (id) => {
    return api.get(`/productos/${id}/movimientos/`)
  },
}
