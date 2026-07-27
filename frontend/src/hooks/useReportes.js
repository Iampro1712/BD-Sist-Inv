import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getReporteInventario,
  getReporteVentas,
  getReporteCompras,
  getProductosMasVendidos,
  getPronosticoDemanda,
  analizarPronosticoIA,
} from '../services/reportes.service'

/**
 * Hook para obtener reporte de inventario
 */
export const useReporteInventario = () => {
  return useQuery({
    queryKey: ['reporte-inventario'],
    queryFn: getReporteInventario,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })
}

/**
 * Hook para obtener reporte de ventas
 */
export const useReporteVentas = (params, enabled = false) => {
  return useQuery({
    queryKey: ['reporte-ventas', params],
    queryFn: () => getReporteVentas(params),
    enabled: Boolean(enabled),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook para obtener reporte de compras
 */
export const useReporteCompras = (params, enabled = false) => {
  return useQuery({
    queryKey: ['reporte-compras', params],
    queryFn: () => getReporteCompras(params),
    enabled: Boolean(enabled),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook para obtener productos más vendidos
 */
export const useProductosMasVendidos = (params, enabled = false) => {
  return useQuery({
    queryKey: ['productos-mas-vendidos', params],
    queryFn: () => getProductosMasVendidos(params),
    enabled: Boolean(enabled),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Pronóstico de demanda. Son cuentas deterministas: mismos datos, mismo
 * resultado, sin llamadas a proveedores externos.
 */
export const usePronosticoDemanda = (params = {}) => {
  return useQuery({
    queryKey: ['pronostico-demanda', params],
    queryFn: () => getPronosticoDemanda(params),
  })
}

/**
 * Interpretación con IA, bajo demanda.
 *
 * Es una mutación y no una consulta a propósito: cada análisis cuesta dinero de
 * la cuenta del proveedor, así que se dispara sólo cuando el usuario lo pide y
 * no automáticamente al abrir la pantalla.
 */
export const useAnalisisIAPronostico = () => {
  return useMutation({
    mutationFn: (payload) => analizarPronosticoIA(payload),
  })
}
