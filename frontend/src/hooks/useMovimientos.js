import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMovimientos, crearAjuste } from '../services/movimientos.service'

/**
 * Hook para gestión de movimientos de inventario
 */
export const useMovimientos = (params = {}) => {
  return useQuery({
    queryKey: ['movimientos', params],
    queryFn: () => getMovimientos(params),
    keepPreviousData: true,
  })
}

/**
 * Hook para crear ajuste manual de inventario
 */
export const useCrearAjuste = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: crearAjuste,
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries(['movimientos'])
      queryClient.invalidateQueries(['productos'])
      queryClient.invalidateQueries(['dashboard'])
    },
  })
}
