import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  devolucionesService, devolucionesCompraService,
} from '../services/devoluciones.service'

export const useDevoluciones = (params = {}) => {
  return useQuery({
    queryKey: ['devoluciones', params],
    queryFn: () => devolucionesService.getAll(params).then(res => res.data),
  })
}

export const useDevolucion = (id) => {
  return useQuery({
    queryKey: ['devoluciones', id],
    queryFn: () => devolucionesService.getById(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCreateDevolucion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => devolucionesService.create(data),
    onSuccess: () => {
      // La devolución reingresa stock y mueve inventario
      queryClient.invalidateQueries({ queryKey: ['devoluciones'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Devoluciones a proveedores
// ---------------------------------------------------------------------------

// Son admin-only en el backend: `enabled` evita dispararle un 403 al operador.
export const useDevolucionesCompra = (params = {}, enabled = true) => {
  return useQuery({
    queryKey: ['devoluciones-compra', params],
    queryFn: () => devolucionesCompraService.getAll(params).then(res => res.data),
    enabled: !!enabled,
  })
}

/** Máximo devolvible por producto de una compra (recibido − devuelto, acotado
 *  por el stock). Es lo que el formulario usa para no dejar pedir de más. */
export const useDevolvible = (idOrden) => {
  return useQuery({
    queryKey: ['devolvible', idOrden],
    queryFn: () => devolucionesCompraService.getDevolvible(idOrden).then(res => res.data),
    enabled: !!idOrden,
  })
}

export const useCreateDevolucionCompra = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => devolucionesCompraService.create(data),
    onSuccess: () => {
      // Toca cuatro cosas a la vez: saca stock, baja la deuda de la compra y,
      // si hubo reembolso en efectivo, entra plata al cajón.
      queryClient.invalidateQueries({ queryKey: ['devoluciones-compra'] })
      queryClient.invalidateQueries({ queryKey: ['devolvible'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
