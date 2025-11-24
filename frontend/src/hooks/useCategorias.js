import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriasService } from '../services/categorias.service'

/**
 * Hook para obtener todas las categorías
 */
export const useCategorias = (params = {}) => {
  return useQuery({
    queryKey: ['categorias', params],
    queryFn: async () => {
      const response = await categoriasService.getAll(params)
      return response.data
    },
  })
}

/**
 * Hook para crear una categoría
 */
export const useCreateCategoria = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const response = await categoriasService.create(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorias'])
      queryClient.invalidateQueries(['productos'])
    },
  })
}

/**
 * Hook para actualizar una categoría
 */
export const useUpdateCategoria = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await categoriasService.update(id, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorias'])
      queryClient.invalidateQueries(['productos'])
    },
  })
}

/**
 * Hook para eliminar una categoría
 */
export const useDeleteCategoria = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const response = await categoriasService.delete(id)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorias'])
      queryClient.invalidateQueries(['productos'])
    },
  })
}
