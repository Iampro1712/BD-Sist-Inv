import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { devolucionesService } from '../services/devoluciones.service'

export const useDevoluciones = (params = {}) => {
  return useQuery({
    queryKey: ['devoluciones', params],
    queryFn: () => devolucionesService.getAll(params).then(res => res.data),
  })
}

export const useDevolucion = (id) => {
  return useQuery({
    queryKey: ['devoluciones', id],
    queryFn: () => devolucionesService.getById(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCreateDevolucion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => devolucionesService.create(data),
    onSuccess: () => {
      // La devolución reingresa stock y mueve inventario
      queryClient.invalidateQueries({ queryKey: ['devoluciones'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
