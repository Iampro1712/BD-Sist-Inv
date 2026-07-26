import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tallerService } from '../services/taller.service'

// Mover una orden puede tocar stock (repuestos) y generar una venta al
// entregar, así que se invalidan también productos y ventas.
const invalidarTaller = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['taller'] })
  queryClient.invalidateQueries({ queryKey: ['productos'] })
  queryClient.invalidateQueries({ queryKey: ['ventas'] })
  queryClient.invalidateQueries({ queryKey: ['preventivo'] })
}

export const useOrdenesTaller = (params = {}) => {
  return useQuery({
    queryKey: ['taller', params],
    queryFn: () => tallerService.getAll(params).then(res => res.data),
  })
}

export const useOrdenTaller = (id) => {
  return useQuery({
    queryKey: ['taller', 'detalle', id],
    queryFn: () => tallerService.get(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCatalogoServicios = () => {
  return useQuery({
    queryKey: ['catalogo-servicios'],
    queryFn: () => tallerService.getCatalogo().then(res => res.data),
  })
}

export const useMotosDeCliente = (clienteId) => {
  return useQuery({
    queryKey: ['motos', clienteId],
    queryFn: () => tallerService.getMotos({ cliente: clienteId }).then(res => res.data),
    enabled: !!clienteId,
  })
}

export const useAgendarServicio = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => tallerService.agendar(data),
    onSuccess: () => invalidarTaller(queryClient),
  })
}

export const useCambiarEstadoOrden = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => tallerService.cambiarEstado(id, data),
    onSuccess: () => invalidarTaller(queryClient),
  })
}

export const useEntregarOrden = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => tallerService.entregar(id, data),
    onSuccess: () => {
      invalidarTaller(queryClient)
      // La venta generada queda pendiente de cobro.
      queryClient.invalidateQueries({ queryKey: ['cuentas-cobrar'] })
    },
  })
}

export const usePresupuestarOrden = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => tallerService.presupuestar(id, data),
    onSuccess: () => {
      invalidarTaller(queryClient)
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}

export const useAgregarRepuesto = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => tallerService.agregarRepuesto(id, data),
    onSuccess: () => invalidarTaller(queryClient),
  })
}

export const useEliminarRepuesto = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, repuestoId }) => tallerService.eliminarRepuesto(id, repuestoId),
    onSuccess: () => invalidarTaller(queryClient),
  })
}

export const useMantenimientoPreventivo = () => {
  return useQuery({
    queryKey: ['preventivo'],
    queryFn: () => tallerService.getPreventivo().then(res => res.data),
  })
}

// El reporte es admin-only: se pasa `enabled` para no disparar un 403 al
// operador, que sí puede usar el resto del taller.
export const useReporteAgendaTaller = (enabled = true) => {
  return useQuery({
    queryKey: ['reporte-agenda-taller'],
    queryFn: () => tallerService.getAgenda().then(res => res.data),
    enabled: !!enabled,
  })
}
