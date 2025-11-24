import api from './api'

export const ordenesCompraService = {
  getAll: (params = {}) => {
    return api.get('/ordenes-compra/', { params })
  },

  getById: (id) => {
    return api.get(`/ordenes-compra/${id}/`)
  },

  create: (data) => {
    return api.post('/ordenes-compra/', data)
  },

  update: (id, data) => {
    return api.put(`/ordenes-compra/${id}/`, data)
  },

  confirmar: (id) => {
    return api.post(`/ordenes-compra/${id}/confirmar/`)
  },

  recibir: (id) => {
    return api.post(`/ordenes-compra/${id}/recibir/`)
  },

  cancelar: (id, motivo) => {
    return api.post(`/ordenes-compra/${id}/cancelar/`, { motivo })
  },
}

export const ordenesVentaService = {
  getAll: (params = {}) => {
    return api.get('/ordenes-venta/', { params })
  },

  getById: (id) => {
    return api.get(`/ordenes-venta/${id}/`)
  },

  create: (data) => {
    return api.post('/ordenes-venta/', data)
  },

  update: (id, data) => {
    return api.put(`/ordenes-venta/${id}/`, data)
  },

  confirmar: (id) => {
    return api.post(`/ordenes-venta/${id}/confirmar/`)
  },

  cancelar: (id, motivo) => {
    return api.post(`/ordenes-venta/${id}/cancelar/`, { motivo })
  },

  aplicarDescuento: (id, descuento) => {
    return api.post(`/ordenes-venta/${id}/aplicar_descuento/`, { descuento })
  },
}
