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

  // Pagos a proveedor (cuentas por pagar)
  getPagos: (idOrden) => api.get(`/ordenes-compra/${idOrden}/pagos/`),
  registrarPago: (idOrden, data) => api.post(`/ordenes-compra/${idOrden}/registrar-pago/`, data),
  eliminarPago: (idOrden, idPago) => api.delete(`/ordenes-compra/${idOrden}/pagos/${idPago}/`),
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

  // Pagos / abonos (pago por adelantado)
  getPagos: (idVenta) => {
    return api.get(`/ordenes-venta/${idVenta}/pagos/`)
  },

  registrarPago: (idVenta, data) => {
    return api.post(`/ordenes-venta/${idVenta}/registrar-pago/`, data)
  },

  eliminarPago: (idVenta, idPago) => {
    return api.delete(`/ordenes-venta/${idVenta}/pagos/${idPago}/`)
  },
}
