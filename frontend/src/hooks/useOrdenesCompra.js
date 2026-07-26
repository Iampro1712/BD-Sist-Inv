import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordenesCompraService } from '../services/ordenes.service'

export const useOrdenesCompra = (params = {}) => {
  return useQuery({
    queryKey: ['ordenes-compra', params],
    queryFn: () => ordenesCompraService.getAll(params).then(res => res.data),
  })
}

export const useOrdenCompra = (id) => {
  return useQuery({
    queryKey: ['ordenes-compra', id],
    queryFn: () => ordenesCompraService.getById(id).then(res => res.data),
    enabled: !!id,
  })
}

export const useCreateOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => ordenesCompraService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    },
  })
}

export const useUpdateOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }) => ordenesCompraService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    },
  })
}

export const useConfirmarOrdenCompra = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id) => ordenesCompraService.confirmar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
      // Confirmar ahora también recibe la mercadería y suma el stock.
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useRecibirOrdenCompra = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => ordenesCompraService.recibir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useCancelarOrdenCompra = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, motivo }) => ordenesCompraService.cancelar(id, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
    },
  })
}

// Pagos a proveedor (cuentas por pagar)
export const useRegistrarPagoCompra = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idOrden, data }) => ordenesCompraService.registrarPago(idOrden, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-pagar'] })
      // Un pago en efectivo afecta el arqueo de la caja abierta.
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
    },
  })
}

export const useEliminarPagoCompra = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ idOrden, idPago }) => ordenesCompraService.eliminarPago(idOrden, idPago),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] })
      queryClient.invalidateQueries({ queryKey: ['cuentas-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
    },
  })
}
