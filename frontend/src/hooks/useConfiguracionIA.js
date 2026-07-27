import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { configuracionIAService } from '../services/configuracionIA.service'

// Cualquier cambio mueve también el resumen de "qué proveedor está activo".
const invalidar = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['configuracion-ia'] })
  queryClient.invalidateQueries({ queryKey: ['configuracion-ia-estado'] })
}

export const useConfiguracionesIA = () => {
  return useQuery({
    queryKey: ['configuracion-ia'],
    queryFn: () => configuracionIAService.getAll().then(res => res.data),
  })
}

export const useCatalogoIA = () => {
  return useQuery({
    queryKey: ['configuracion-ia-catalogo'],
    queryFn: () => configuracionIAService.catalogo().then(res => res.data),
    // El catálogo solo cambia cuando se despliega una versión nueva.
    staleTime: Infinity,
  })
}

/**
 * Modelos que el proveedor ofrece hoy para esta clave.
 *
 * Sale de una llamada al proveedor, no de una lista guardada: así aparecen los
 * modelos nuevos sin esperar una actualización del sistema. Como cuesta una
 * llamada de red, no se reintenta en bucle ni se refresca al volver a la
 * pestaña; hay un botón para reintentar a mano.
 */
export const useModelosIA = (id, habilitado = true) => {
  return useQuery({
    queryKey: ['configuracion-ia', id, 'modelos'],
    queryFn: () => configuracionIAService.modelos(id).then(res => res.data),
    enabled: !!id && !!habilitado,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  })
}

export const useEstadoIA = () => {
  return useQuery({
    queryKey: ['configuracion-ia-estado'],
    queryFn: () => configuracionIAService.estado().then(res => res.data),
  })
}

export const useGuardarIA = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => configuracionIAService.guardar(data),
    onSuccess: () => invalidar(queryClient),
  })
}

export const useActivarIA = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => configuracionIAService.activar(id),
    onSuccess: () => invalidar(queryClient),
  })
}

export const useProbarIA = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => configuracionIAService.probar(id),
    // Probar guarda el resultado en la fila, así que hay que refrescar.
    onSettled: () => invalidar(queryClient),
  })
}

export const useEliminarIA = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => configuracionIAService.remove(id),
    onSuccess: () => invalidar(queryClient),
  })
}
