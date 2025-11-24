import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordenesVentaService } from '../services/ordenes.service'

export const useOrdenesVenta = (params = {}) => {
  return useQuery({
    queryKey: ['ordenes-venta', params],
    queryFn: () => ordenesVentaService.getAll(params).then(res => res.data),
  })
}

export const useOrdenVenta = (id) => {
  return useQuery({
    queryKey: ['ordenes-venta', id],
    queryFn: () => ordenesVentaService.getById(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCreateOrdenVenta = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => ordenesVentaService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useUpdateOrdenVenta = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }) => ordenesVentaService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
    },
  })
}

export const useConfirmarOrdenVenta = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id) => ordenesVentaService.confirmar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCancelarOrdenVenta = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, motivo }) => ordenesVentaService.cancelar(id, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useAplicarDescuento = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, descuento }) => ordenesVentaService.aplicarDescuento(id, descuento),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
    },
  })
}
