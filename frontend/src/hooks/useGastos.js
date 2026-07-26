import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gastosService } from '../services/gastos.service'

export const useGastos = (params = {}) => {
  return useQuery({
    queryKey: ['gastos', params],
    queryFn: () => gastosService.getAll(params).then(res => res.data),
  })
}

export const useCategoriasGasto = () => {
  return useQuery({
    queryKey: ['categorias-gasto'],
    queryFn: () => gastosService.getCategorias().then(res => res.data),
  })
}

export const useCrearGasto = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => gastosService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] })
      // Un gasto en efectivo afecta el arqueo de la caja abierta.
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
    },
  })
}

export const useEliminarGasto = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => gastosService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] })
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
    },
  })
}

export const useCrearCategoriaGasto = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => gastosService.crearCategoria(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorias-gasto'] }),
  })
}

export const useEstadoResultados = (params, enabled) => {
  return useQuery({
    queryKey: ['estado-resultados', params],
    queryFn: () => gastosService.getEstadoResultados(params).then(res => res.data),
    enabled: !!enabled,
  })
}
