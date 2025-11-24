import api from './api'

/**
 * Servicio para búsqueda global
 */

// Búsqueda en productos
export const searchProductos = async (query) => {
  const response = await api.get('/productos/', {
    params: { search: query, page_size: 5 },
  })
  return response.data.results || []
}

// Búsqueda en clientes
export const searchClientes = async (query) => {
  const response = await api.get('/clientes/', {
    params: { search: query, page_size: 5 },
  })
  return response.data.results || []
}

// Búsqueda en proveedores
export const searchProveedores = async (query) => {
  const response = await api.get('/proveedores/', {
    params: { search: query, page_size: 5 },
  })
  return response.data.results || []
}

// Búsqueda en órdenes de compra
export const searchOrdenesCompra = async (query) => {
  const response = await api.get('/ordenes-compra/', {
    params: { search: query, page_size: 5 },
  })
  return response.data.results || []
}

// Búsqueda en órdenes de venta
export const searchOrdenesVenta = async (query) => {
  const response = await api.get('/ordenes-venta/', {
    params: { search: query, page_size: 5 },
  })
  return response.data.results || []
}

// Búsqueda global (todas las entidades)
export const globalSearch = async (query) => {
  if (!query || query.trim().length < 2) {
    return {
      productos: [],
      clientes: [],
      proveedores: [],
      ordenesCompra: [],
      ordenesVenta: [],
    }
  }

  try {
    const [productos, clientes, proveedores, ordenesCompra, ordenesVenta] = await Promise.all([
      searchProductos(query),
      searchClientes(query),
      searchProveedores(query),
      searchOrdenesCompra(query),
      searchOrdenesVenta(query),
    ])

    return {
      productos,
      clientes,
      proveedores,
      ordenesCompra,
      ordenesVenta,
    }
  } catch (error) {
    console.error('Error en búsqueda global:', error)
    throw error
  }
}

export default {
  searchProductos,
  searchClientes,
  searchProveedores,
  searchOrdenesCompra,
  searchOrdenesVenta,
  globalSearch,
}
