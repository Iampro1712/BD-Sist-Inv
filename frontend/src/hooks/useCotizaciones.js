import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cotizacionesService } from '../services/cotizaciones.service'

export const useCotizaciones = (params = {}) => {
  return useQuery({
    queryKey: ['cotizaciones', params],
    queryFn: () => cotizacionesService.getAll(params).then(res => res.data),
  })
}

export const useCotizacion = (id) => {
  return useQuery({
    queryKey: ['cotizaciones', id],
    queryFn: () => cotizacionesService.getById(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCreateCotizacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => cotizacionesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}

export const useConvertirCotizacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => cotizacionesService.convertirVenta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCambiarEstadoCotizacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, estado }) => cotizacionesService.cambiarEstado(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
      // Aprobar un presupuesto de reparación carga la orden de trabajo y
      // consume repuestos del inventario.
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

export const useDeleteCotizacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => cotizacionesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}
