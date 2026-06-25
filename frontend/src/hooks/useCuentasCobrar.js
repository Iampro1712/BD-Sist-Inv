import { useQuery } from '@tanstack/react-query'
import { cuentasCobrarService } from '../services/cuentasCobrar.service'

export const useCuentasCobrar = () => {
  return useQuery({
    queryKey: ['cuentas-cobrar'],
    queryFn: () => cuentasCobrarService.get().then(res => res.data),
  })
}
