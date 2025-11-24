import { motion } from 'framer-motion'
import { Badge, Loader } from '../ui'
import { fadeIn } from '../../utils/animations'

const ProductoDetalle = ({ producto, movimientos = [], isLoadingMovimientos = false }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTipoMovimientoBadge = (tipo) => {
    const variants = {
      entrada: 'success',
      salida: 'danger',
      ajuste: 'warning',
    }
    return variants[tipo] || 'default'
  }

  return (
    <div className="space-y-6">
      {/* Información General */}
      <motion.div variants={fadeIn} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información General</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Código (SKU)</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{producto.sku_producto}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Nombre</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{producto.nombre}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Stock Mínimo</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{producto.cantidad_minima}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Stock Total</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{producto.cantidad_total}</p>
          </div>
        </div>
      </motion.div>

      {/* Precios e Inventario */}
      <motion.div variants={fadeIn} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-100 dark:border-blue-800">
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Precio de Compra Unitario</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{formatCurrency(producto.precio_compra_unitario)}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-100 dark:border-green-800">
          <p className="text-sm text-green-600 dark:text-green-400 mb-1">Precio Final (Venta)</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300">{formatCurrency(producto.precio_final)}</p>
        </div>
        <div className={`rounded-lg p-6 border ${producto.cantidad_actual <= producto.cantidad_minima ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
          <p className={`text-sm mb-1 ${producto.cantidad_actual <= producto.cantidad_minima ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
            Stock Actual
          </p>
          <p className={`text-2xl font-bold ${producto.cantidad_actual <= producto.cantidad_minima ? 'text-red-900 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
            {producto.cantidad_actual}
            {producto.cantidad_actual <= producto.cantidad_minima && (
              <span className="text-sm font-normal text-red-600 dark:text-red-400 ml-2">
                (Mín: {producto.cantidad_minima})
              </span>
            )}
          </p>
        </div>
      </motion.div>

      {/* Historial de Movimientos */}
      <motion.div variants={fadeIn} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Historial de Movimientos</h3>
        </div>
        <div className="p-6">
          {isLoadingMovimientos ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : movimientos.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay movimientos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Referencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Notas
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {movimientos.map((movimiento) => (
                    <tr key={movimiento.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                        {formatDate(movimiento.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getTipoMovimientoBadge(movimiento.tipo)}>
                          {movimiento.tipo_display}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {movimiento.tipo === 'entrada' ? '+' : '-'}{movimiento.cantidad}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {movimiento.referencia || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {movimiento.notas || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default ProductoDetalle
