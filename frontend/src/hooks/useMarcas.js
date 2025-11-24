import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { marcasService } from '../services/categorias.service'

/**
 * Hook para obtener todas las marcas
 */
export const useMarcas = (params = {}) => {
  return useQuery({
    queryKey: ['marcas', params],
    queryFn: async () => {
      const response = await marcasService.getAll(params)
      return response.data
    },
  })
}

/**
 * Hook para crear una marca
 */
export const useCreateMarca = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const response = await marcasService.create(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marcas'])
      queryClient.invalidateQueries(['productos'])
    },
  })
}

/**
 * Hook para actualizar una marca
 */
export const useUpdateMarca = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await marcasService.update(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marcas'])
      queryClient.invalidateQueries(['productos'])
    },
  })
}

/**
 * Hook para eliminar una marca
 */
export const useDeleteMarca = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const response = await marcasService.delete(id)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marcas'])
      queryClient.invalidateQueries(['productos'])
    },
  })
}
