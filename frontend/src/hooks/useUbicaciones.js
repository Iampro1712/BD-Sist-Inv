import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ubicacionesService } from '../services/ubicaciones.service'

// Mover ubicaciones cambia lo que muestra el listado de productos, y aplicar un
// conteo mueve stock de verdad.
const invalidarUbicaciones = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['ubicaciones'] })
  queryClient.invalidateQueries({ queryKey: ['productos'] })
}

export const useUbicaciones = (params = {}) => {
  return useQuery({
    queryKey: ['ubicaciones', params],
    queryFn: () => ubicacionesService.getAll(params).then(res => res.data),
  })
}

export const useProductosDeUbicacion = (id) => {
  return useQuery({
    queryKey: ['ubicaciones', id, 'productos'],
    queryFn: () => ubicacionesService.productos(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCrearUbicacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => ubicacionesService.create(data),
    onSuccess: () => invalidarUbicaciones(queryClient),
  })
}

export const useActualizarUbicacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => ubicacionesService.update(id, data),
    onSuccess: () => invalidarUbicaciones(queryClient),
  })
}

export const useEliminarUbicacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => ubicacionesService.remove(id),
    onSuccess: () => invalidarUbicaciones(queryClient),
  })
}

export const useAsignarUbicacion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => ubicacionesService.asignar(data),
    onSuccess: () => invalidarUbicaciones(queryClient),
  })
}

export const useConteoFisico = (params = {}, enabled = true) => {
  return useQuery({
    queryKey: ['conteo-fisico', params],
    queryFn: () => ubicacionesService.getConteo(params).then(res => res.data),
    enabled: !!enabled,
  })
}

export const useAplicarConteo = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => ubicacionesService.aplicarConteo(data),
    onSuccess: () => {
      invalidarUbicaciones(queryClient)
      queryClient.invalidateQueries({ queryKey: ['conteo-fisico'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
    },
  })
}
