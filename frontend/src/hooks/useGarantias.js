import { useQuery } from '@tanstack/react-query'
import { garantiasService } from '../services/garantias.service'

export const useGarantias = (params = {}) => {
  return useQuery({
    queryKey: ['garantias', params],
    queryFn: async () => {
      const response = await garantiasService.getAll(params)
      return response.data
    },
  })
}

export const useGarantia = (id) => {
  return useQuery({
    queryKey: ['garantias', id],
    queryFn: async () => {
      const response = await garantiasService.getById(id)
      return response.data
    },
    enabled: !!id,
  })
}
