import { motion } from 'framer-motion'
import { Badge, Button } from '../ui'
import { fadeIn } from '../../utils/animations'
import { usePreciosDeProducto } from '../../hooks/useProveedores'

const ProductoDetalle = ({ producto, onEdit }) => {
  const { data: precios } = usePreciosDeProducto(producto?.id_producto)
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(value || 0)
  }

  const margen = producto.precio_final && producto.precio_compra_unitario
    ? parseFloat(producto.precio_final) - parseFloat(producto.precio_compra_unitario)
    : null
  const margenPct = margen !== null && producto.precio_compra_unitario > 0
    ? ((margen / parseFloat(producto.precio_compra_unitario)) * 100).toFixed(1)
    : null

  const stockRatio = producto.cantidad_minima > 0
    ? producto.cantidad_actual / producto.cantidad_minima
    : producto.cantidad_actual > 0 ? 2 : 0

  const stockColor = stockRatio <= 0
    ? { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-800', bar: 'bg-red-500', label: 'Sin stock', badge: 'danger' }
    : stockRatio <= 1
    ? { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-800', bar: 'bg-red-500', label: 'Stock bajo', badge: 'danger' }
    : stockRatio <= 1.5
    ? { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-100 dark:border-yellow-800', bar: 'bg-yellow-400', label: 'Stock justo', badge: 'warning' }
    : { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-800', bar: 'bg-green-500', label: 'Stock OK', badge: 'success' }

  const barWidth = Math.min((producto.cantidad_actual / Math.max(producto.cantidad_minima * 2, 1)) * 100, 100)

  return (
    <div className="space-y-5">
      {/* Header del producto */}
      <motion.div variants={fadeIn} className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-xl shrink-0">
            <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{producto.nombre}</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mt-0.5">
              {producto.sku_producto}
            </span>
          </div>
        </div>
        {onEdit && (
          <Button variant="secondary" onClick={onEdit} className="shrink-0 text-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </Button>
        )}
      </motion.div>

      {/* Info general + proveedor */}
      <motion.div variants={fadeIn} className="grid grid-cols-2 gap-3">
        {producto.proveedor_nombre && (
          <div className="col-span-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Proveedor</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{producto.proveedor_nombre}</p>
            </div>
          </div>
        )}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">Stock mínimo</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{producto.cantidad_minima}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">Stock total acumulado</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{producto.cantidad_total}</p>
        </div>
      </motion.div>

      {/* A qué precio lo vendió cada proveedor, según el historial de compras */}
      {(precios?.proveedores?.length || 0) > 0 && (
        <motion.div variants={fadeIn}
          className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Precio por proveedor (historial de compras)
          </p>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {precios.proveedores.map((p) => (
              <div key={p.id_proveedor}
                className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className={p.id_proveedor === precios.proveedores[0].id_proveedor
                  ? 'font-semibold text-green-700 dark:text-green-400'
                  : 'text-gray-700 dark:text-gray-300'}>
                  {p.proveedor}
                  {p.id_proveedor === precios.proveedores[0].id_proveedor
                    && precios.proveedores.length > 1 && ' · más barato'}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {p.veces_comprado}x
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(p.ultimo_precio)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Garantía */}
      {producto.meses_garantia > 0 && (
        <motion.div variants={fadeIn} className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">Garantía</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xl font-bold text-purple-900 dark:text-purple-200">{producto.meses_garantia} meses</p>
            </div>
            {producto.tipo_garantia && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                producto.tipo_garantia === 'fabricante' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                producto.tipo_garantia === 'proveedor' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
              }`}>
                {producto.tipo_garantia === 'fabricante' ? 'Fabricante' :
                 producto.tipo_garantia === 'proveedor' ? 'Proveedor' : 'Tienda'}
              </span>
            )}
          </div>
          {producto.descripcion_garantia && (
            <p className="mt-2 text-xs text-purple-700 dark:text-purple-300 leading-relaxed">{producto.descripcion_garantia}</p>
          )}
        </motion.div>
      )}

      {/* Precios e inventario */}
      <motion.div variants={fadeIn} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Precio Compra</p>
          </div>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-200">{formatCurrency(producto.precio_compra_unitario)}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium text-green-600 dark:text-green-400">Precio Venta</p>
          </div>
          <p className="text-xl font-bold text-green-900 dark:text-green-200">{formatCurrency(producto.precio_final)}</p>
          {margen !== null && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              +{formatCurrency(margen)} · {margenPct}% margen
            </p>
          )}
        </div>

        <div className={`rounded-xl p-4 border ${stockColor.bg} ${stockColor.border}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${stockColor.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <p className={`text-xs font-medium ${stockColor.text}`}>Stock Actual</p>
            </div>
            <Badge variant={stockColor.badge}>{stockColor.label}</Badge>
          </div>
          <p className={`text-xl font-bold ${stockColor.text}`}>{producto.cantidad_actual}</p>
          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${stockColor.bar}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">mín. {producto.cantidad_minima}</p>
        </div>
      </motion.div>

    </div>
  )
}

export default ProductoDetalle
