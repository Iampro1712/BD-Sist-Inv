import api from './api'

export const dashboardService = {
  getStats: () => {
    return api.get('/dashboard/stats/')
  },
}

export const reportesService = {
  getInventario: () => {
    return api.get('/reportes/inventario/')
  },

  getVentas: (fechaInicio, fechaFin) => {
    return api.get('/reportes/ventas/', {
      params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    })
  },

  getCompras: (fechaInicio, fechaFin, proveedorId = null) => {
    const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
    if (proveedorId) params.proveedor = proveedorId
    return api.get('/reportes/compras/', { params })
  },

  getProductosMasVendidos: (limite = 10, fechaInicio = null, fechaFin = null) => {
    const params = { limite }
    if (fechaInicio) params.fecha_inicio = fechaInicio
    if (fechaFin) params.fecha_fin = fechaFin
    return api.get('/reportes/productos-mas-vendidos/', { params })
  },
}
