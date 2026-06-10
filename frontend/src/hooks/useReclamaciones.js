import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reclamacionesService } from '../services/reclamaciones.service'

export const useReclamaciones = (params = {}) => {
  return useQuery({
    queryKey: ['reclamaciones', params],
    queryFn: async () => {
      const response = await reclamacionesService.getAll(params)
      return response.data
    },
  })
}

export const useCreateReclamacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => reclamacionesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reclamaciones'] })
      queryClient.invalidateQueries({ queryKey: ['garantias'] })
    },
  })
}

export const useResolverReclamacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, resolucion }) => reclamacionesService.resolver(id, resolucion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reclamaciones'] })
      queryClient.invalidateQueries({ queryKey: ['garantias'] })
    },
  })
}
