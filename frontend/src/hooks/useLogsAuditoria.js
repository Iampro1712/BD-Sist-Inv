import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

/**
 * Hook para gestionar logs de auditoría de productos
 */
export const useLogsAuditoria = (filters = {}) => {
  // Query para obtener logs con filtros
  const {
    data: logsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['auditoria-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      if (filters.search) params.append('search', filters.search)
      if (filters.id_producto) params.append('id_producto', filters.id_producto)
      if (filters.operacion) params.append('operacion', filters.operacion)
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio)
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin)
      
      const response = await api.get(`/auditoria-productos/?${params.toString()}`)
      // El endpoint retorna { count, next, previous, results }
      return response.data.results || response.data
    },
    staleTime: 30000, // 30 segundos
    refetchOnWindowFocus: true
  })

  // Asegurar que logs sea siempre un array
  const logs = Array.isArray(logsData) ? logsData : []
  
  // Debug
  console.log('🔍 Hook Debug:', {
    logsData,
    logs,
    logsLength: logs.length,
    isLoading,
    error: error?.message
  })

  // Query para obtener estadísticas
  const {
    data: estadisticas = null,
    isLoading: isLoadingEstadisticas
  } = useQuery({
    queryKey: ['auditoria-estadisticas'],
    queryFn: async () => {
      const response = await api.get('/auditoria-productos/estadisticas/')
      return response.data
    },
    staleTime: 60000, // 1 minuto
    refetchOnWindowFocus: false
  })

  return {
    logs,
    isLoading,
    error,
    refetch,
    estadisticas,
    isLoadingEstadisticas
  }
}

/**
 * Hook para obtener historial de un producto específico
 */
export const useHistorialProducto = (idProducto) => {
  return useQuery({
    queryKey: ['auditoria-producto', idProducto],
    queryFn: async () => {
      const response = await api.get(`/auditoria-productos/por_producto/?id_producto=${idProducto}`)
      return response.data
    },
    enabled: !!idProducto,
    staleTime: 30000
  })
}
