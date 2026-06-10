import { motion } from 'framer-motion'
import { fadeIn } from '../../utils/animations'

const OrdenVentaDetalle = ({ orden }) => {
  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const totalItems = orden.productos?.reduce((s, p) => s + (p.cantidad || 1), 0) || 0
  const subtotal   = orden.productos?.reduce((s, p) => s + (p.subtotal || 0), 0) || 0
  const descuento  = subtotal - (orden.total || 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <motion.div variants={fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">
            Orden de Venta
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">#{orden.id_venta}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
            {formatDate(orden.fecha)}
          </p>
        </div>
      </motion.div>

      {/* Cliente */}
      <motion.div variants={fadeIn} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
            {(orden.cliente_nombre || '?')[0].toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Cliente</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{orden.cliente_nombre}</p>
        </div>
      </motion.div>

      {/* Productos */}
      <motion.div variants={fadeIn}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Productos
          </p>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {totalItems} unidad{totalItems !== 1 ? 'es' : ''}
          </span>
        </div>

        {orden.productos && orden.productos.length > 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-20">Cant.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-32">Precio unit.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-32">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {orden.productos.map((producto, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{producto.nombre}</p>
                      {producto.sku && (
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{producto.sku}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {producto.cantidad}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(producto.precio_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(producto.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No hay productos en esta venta
          </div>
        )}
      </motion.div>

      {/* Totales */}
      <motion.div variants={fadeIn} className="space-y-1">
        {descuento > 0 && (
          <div className="flex items-center justify-between px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        )}
        {descuento > 0 && (
          <div className="flex items-center justify-between px-4 py-2 text-sm text-green-600 dark:text-green-400">
            <span>Descuento aplicado</span>
            <span>−{formatCurrency(descuento)}</span>
          </div>
        )}
        <div className="bg-gray-900 dark:bg-gray-700 rounded-xl px-5 py-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Total de la venta</span>
          <span className="text-2xl font-bold text-white">{formatCurrency(orden.total)}</span>
        </div>
      </motion.div>

      {/* Notas */}
      {orden.notas && (
        <motion.div variants={fadeIn} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex gap-3">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Notas</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{orden.notas}</p>
          </div>
        </motion.div>
      )}

    </div>
  )
}

export default OrdenVentaDetalle
