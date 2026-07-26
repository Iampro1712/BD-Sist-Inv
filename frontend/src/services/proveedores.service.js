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

  // Desempeño: tiempos de entrega, monto comprado, saldo (admin)
  getDesempeno: () => api.get('/reportes/desempeno-proveedores/'),

  // Comparación de precios y oportunidades de ahorro (admin)
  getComparacionPrecios: () => api.get('/reportes/comparacion-precios/'),

  // A qué precio le vendió cada proveedor un producto. Cualquier usuario
  // autenticado: el que compra lo necesita en el momento de decidir.
  getPreciosDeProducto: (idProducto) =>
    api.get(`/productos/${idProducto}/precios-proveedores/`),
}
