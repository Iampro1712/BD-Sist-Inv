import { useQuery } from '@tanstack/react-query'
import { rentabilidadService } from '../services/rentabilidad.service'

export const useRentabilidad = () => {
  return useQuery({
    queryKey: ['rentabilidad'],
    queryFn: () => rentabilidadService.rentabilidad().then(res => res.data),
  })
}

export const useStockMuerto = (dias = 90) => {
  return useQuery({
    queryKey: ['stock-muerto', dias],
    queryFn: () => rentabilidadService.stockMuerto(dias).then(res => res.data),
  })
}
