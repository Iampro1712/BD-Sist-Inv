import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cajaService } from '../services/caja.service'

// Sesión abierta actual. Devuelve null si no hay caja abierta.
export const useCajaActual = () => {
  return useQuery({
    queryKey: ['caja-actual'],
    queryFn: () => cajaService.getActual().then(res => res.data),
  })
}

export const useHistorialCaja = (params = {}) => {
  return useQuery({
    queryKey: ['caja-historial', params],
    queryFn: () => cajaService.getHistorial(params).then(res => res.data),
  })
}

const invalidarCaja = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
  queryClient.invalidateQueries({ queryKey: ['caja-historial'] })
}

export const useAbrirCaja = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => cajaService.abrir(data),
    onSuccess: () => invalidarCaja(queryClient),
  })
}

export const useCerrarCaja = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => cajaService.cerrar(id, data),
    onSuccess: () => invalidarCaja(queryClient),
  })
}

export const useCrearMovimiento = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => cajaService.crearMovimiento(id, data),
    onSuccess: () => invalidarCaja(queryClient),
  })
}
