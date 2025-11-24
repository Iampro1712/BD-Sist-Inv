import api from './api'

export const proveedoresService = {
  // Get all proveedores
  getAll: (params = {}) => {
    return api.get('/proveedores/', { params })
  },

  // Get single proveedor
  getById: (id) => {
    return api.get(`/proveedores/${id}/`)
  },

  // Create proveedor
  create: (data) => {
    return api.post('/proveedores/', data)
  },

  // Update proveedor
  update: (id, data) => {
    return api.put(`/proveedores/${id}/`, data)
  },

  // Partial update
  partialUpdate: (id, data) => {
    return api.patch(`/proveedores/${id}/`, data)
  },

  // Delete proveedor
  delete: (id) => {
    return api.delete(`/proveedores/${id}/`)
  },

  // Get productos of proveedor
  getProductos: (id) => {
    return api.get(`/proveedores/${id}/productos/`)
  },

  // Get ordenes de compra of proveedor
  getOrdenes: (id) => {
    return api.get(`/proveedores/${id}/ordenes/`)
  },
}
