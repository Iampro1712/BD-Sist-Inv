import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientesService } from '../services/clientes.service'

export const useClientes = (params = {}) => {
  return useQuery({
    queryKey: ['clientes', params],
    queryFn: async () => {
      const response = await clientesService.getAll(params)
      return response.data
    },
  })
}

export const useCliente = (id) => {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: async () => {
      const response = await clientesService.getById(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useCreateCliente = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => clientesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}

export const useUpdateCliente = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }) => clientesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}

export const useDeleteCliente = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id) => clientesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}

export const useClienteOrdenes = (id) => {
  return useQuery({
    queryKey: ['clientes', id, 'ordenes'],
    queryFn: async () => {
      const response = await clientesService.getOrdenes(id)
      return response.data
    },
    enabled: !!id,
  })
}
