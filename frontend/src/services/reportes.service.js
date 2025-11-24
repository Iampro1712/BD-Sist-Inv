import api from './api'

/**
 * Servicio para generación de reportes
 */

// Obtener reporte de inventario
export const getReporteInventario = async () => {
  const response = await api.get('/reportes/inventario/')
  return response.data
}

// Obtener reporte de ventas
export const getReporteVentas = async (params) => {
  const response = await api.get('/reportes/ventas/', { params })
  return response.data
}

// Obtener reporte de compras
export const getReporteCompras = async (params) => {
  const response = await api.get('/reportes/compras/', { params })
  return response.data
}

// Obtener productos más vendidos
export const getProductosMasVendidos = async (params) => {
  const response = await api.get('/reportes/productos_mas_vendidos/', { params })
  return response.data
}

export default {
  getReporteInventario,
  getReporteVentas,
  getReporteCompras,
  getProductosMasVendidos,
}
