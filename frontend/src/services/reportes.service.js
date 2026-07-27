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

// Pronóstico de demanda: qué recomprar, cuándo y cuánto. Son cuentas, no IA.
export const getPronosticoDemanda = async (params) => {
  const response = await api.get('/reportes/pronostico-demanda/', { params })
  return response.data
}

// Interpretación con IA del pronóstico. Va aparte del cálculo a propósito: si
// el proveedor de IA está caído o sin saldo, el pronóstico sigue sirviendo.
export const analizarPronosticoIA = async (payload) => {
  const response = await api.post('/reportes/pronostico-demanda/analizar/', payload)
  return response.data
}
