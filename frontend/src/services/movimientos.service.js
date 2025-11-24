import api from './api'

/**
 * Servicio para gestión de movimientos de inventario
 */

// Obtener lista de movimientos con filtros
export const getMovimientos = async (params = {}) => {
  const response = await api.get('/movimientos/', { params })
  return response.data
}

// Crear ajuste manual de inventario
export const crearAjuste = async (data) => {
  const response = await api.post('/movimientos/ajuste/', data)
  return response.data
}

// Obtener movimientos de un producto específico
export const getMovimientosPorProducto = async (productoId) => {
  const response = await api.get(`/productos/${productoId}/movimientos/`)
  return response.data
}

export default {
  getMovimientos,
  crearAjuste,
  getMovimientosPorProducto,
}
