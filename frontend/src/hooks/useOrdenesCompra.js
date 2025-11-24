import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordenesCompraService } from '../services/ordenes.service'

export const useOrdenesCompra = (params = {}) => {
  return useQuery({
    queryKey: ['ordenes-compra', params],
    queryFn: () => ordenesCompraService.getAll(params).then(res => res.data),
  })
}

export const useOrdenCompra = (id) => {
  return useQuery({
    queryKey: ['ordenes-compra', id],
    queryFn: () => ordenesCompraService.getById(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCreateOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => ordenesCompraService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    },
  })
}

export const useUpdateOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }) => ordenesCompraService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    },
  })
}

export const useConfirmarOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id) => ordenesCompraService.confirmar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    },
  })
}

export const useRecibirOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id) => ordenesCompraService.recibir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCancelarOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, motivo }) => ordenesCompraService.cancelar(id, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    },
  })
}
