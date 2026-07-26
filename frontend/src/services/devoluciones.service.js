import api from './api'

export const devolucionesService = {
  getAll:  (params = {}) => api.get('/devoluciones/', { params }),
  getById: (id)          => api.get(`/devoluciones/${id}/`),
  create:  (data)        => api.post('/devoluciones/', data),
}

/** Devoluciones a proveedores: sacan stock y bajan la deuda (tabla aparte). */
export const devolucionesCompraService = {
  getAll:  (params = {}) => api.get('/devoluciones-compra/', { params }),
  getById: (id)          => api.get(`/devoluciones-compra/${id}/`),
  create:  (data)        => api.post('/devoluciones-compra/', data),

  // Cuánto se puede devolver de cada producto de una compra
  getDevolvible: (idOrden) => api.get(`/devoluciones-compra/devolvible/${idOrden}/`),

  getReporte: () => api.get('/reportes/devoluciones-proveedor/'),
}
