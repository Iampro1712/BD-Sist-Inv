import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { proveedoresService } from '../services/proveedores.service'

export const useProveedores = (params = {}) => {
  return useQuery({
    queryKey: ['proveedores', params],
    queryFn: async () => {
      const response = await proveedoresService.getAll(params)
      return response.data
    },
  })
}

export const useProveedor = (id) => {
  return useQuery({
    queryKey: ['proveedores', id],
    queryFn: async () => {
      const response = await proveedoresService.getById(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useCreateProveedor = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data) => proveedoresService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
    },
  })
}

export const useUpdateProveedor = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }) => proveedoresService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
    },
  })
}

export const useDeleteProveedor = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id) => proveedoresService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
    },
  })
}

export const useProveedorProductos = (id) => {
  return useQuery({
    queryKey: ['proveedores', id, 'productos'],
    queryFn: async () => {
      const response = await proveedoresService.getProductos(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useProveedorOrdenes = (id) => {
  return useQuery({
    queryKey: ['proveedores', id, 'ordenes'],
    queryFn: async () => {
      const response = await proveedoresService.getOrdenes(id)
      return response.data
    },
    enabled: !!id,
  })
}

// Los dos reportes son admin-only: se pasa `enabled` para no dispararle un 403
// al operador, que sí puede usar el resto del módulo de compras.
export const useDesempenoProveedores = (enabled = true) => {
  return useQuery({
    queryKey: ['desempeno-proveedores'],
    queryFn: () => proveedoresService.getDesempeno().then(r => r.data),
    enabled: !!enabled,
  })
}

export const useComparacionPrecios = (enabled = true) => {
  return useQuery({
    queryKey: ['comparacion-precios'],
    queryFn: () => proveedoresService.getComparacionPrecios().then(r => r.data),
    enabled: !!enabled,
  })
}

/** Precios históricos de un producto por proveedor (para el aviso al comprar). */
export const usePreciosDeProducto = (idProducto) => {
  return useQuery({
    queryKey: ['precios-producto', idProducto],
    queryFn: () => proveedoresService.getPreciosDeProducto(idProducto).then(r => r.data),
    enabled: !!idProducto,
  })
}
