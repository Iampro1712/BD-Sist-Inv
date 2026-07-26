import { useQuery } from '@tanstack/react-query'
import { cuentasPagarService } from '../services/cuentasPagar.service'

export const useCuentasPagar = () => {
  return useQuery({
    queryKey: ['cuentas-pagar'],
    queryFn: () => cuentasPagarService.get().then(res => res.data),
  })
}
