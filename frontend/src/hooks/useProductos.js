import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productosService } from '../services/productos.service'

export const useProductos = (params = {}) => {
  return useQuery({
    queryKey: ['productos', params],
    queryFn: async () => {
      const response = await productosService.getAll(params)
      return response.data
    },
  })
}

export const useProducto = (id) => {
  return useQuery({
    queryKey: ['productos', id],
    queryFn: async () => {
      const response = await productosService.getById(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useProductosStockBajo = () => {
  return useQuery({
    queryKey: ['productos', 'stock-bajo'],
    queryFn: async () => {
      const response = await productosService.getStockBajo()
      return response.data
    },
  })
}

export const useCreateProducto = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => productosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

export const useUpdateProducto = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }) => productosService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

export const useDeleteProducto = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id) => productosService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

export const useProductoMovimientos = (id) => {
  return useQuery({
    queryKey: ['productos', id, 'movimientos'],
    queryFn: async () => {
      const response = await productosService.getMovimientos(id)
      return response.data
    },
    enabled: !!id,
  })
}
