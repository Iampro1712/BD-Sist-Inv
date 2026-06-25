import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { useRentabilidad, useStockMuerto } from '../hooks/useRentabilidad'
import { Card } from '../components/ui'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca'

const Rentabilidad = () => {
  const [dias, setDias] = useState(90)
  const { data: rent, isLoading: loadingRent, error: errorRent } = useRentabilidad()
  const { data: muerto, isLoading: loadingMuerto } = useStockMuerto(dias)

  const productos = rent?.productos || []
  const stockMuerto = muerto?.productos || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rentabilidad</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Margen y utilidad por producto, y detección de stock muerto (capital estancado)
        </p>
      </div>

      {errorRent && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar rentabilidad: {errorRent.message}
        </div>
      )}

      {/* Tarjetas resumen */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Inventario a costo', value: rent?.valor_inventario_costo, color: 'text-gray-900 dark:text-white' },
          { label: 'Inventario a venta', value: rent?.valor_inventario_venta, color: 'text-gray-900 dark:text-white' },
          { label: 'Utilidad potencial', value: rent?.utilidad_potencial, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Utilidad realizada', value: rent?.utilidad_realizada, color: 'text-green-600 dark:text-green-400' },
        ].map((c) => (
          <motion.div key={c.label} variants={fadeIn}>
            <Card className="p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Rentabilidad por producto */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">
          Rentabilidad por producto
        </h2>
        {loadingRent ? (
          <Card className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
          </Card>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Margen</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendidos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Utilidad</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {productos.map((p) => (
                    <tr key={p.id_producto} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{p.nombre}</p>
                        {p.sku && <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{p.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatCurrency(p.costo)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatCurrency(p.precio_venta)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${p.margen_unitario >= 0 ? 'text-gray-700 dark:text-gray-300' : 'text-red-500'}`}>
                          {formatCurrency(p.margen_unitario)}
                        </span>
                        <span className="block text-xs text-gray-400">{p.margen_pct}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{p.vendidos}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(p.utilidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stock muerto */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
            Stock muerto
          </h2>
          <select
            value={dias}
            onChange={(e) => setDias(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value={30}>Sin venta en 30 días</option>
            <option value={60}>Sin venta en 60 días</option>
            <option value={90}>Sin venta en 90 días</option>
            <option value={180}>Sin venta en 180 días</option>
          </select>
        </div>

        {/* Resumen capital inmovilizado */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Capital inmovilizado en {muerto?.num_productos || 0} producto(s) sin rotación
          </span>
          <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(muerto?.capital_inmovilizado_total)}
          </span>
        </div>

        {loadingMuerto ? (
          <Card className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
          </Card>
        ) : stockMuerto.length === 0 ? (
          <Card className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            ¡Ningún producto estancado en este período! Todo tu inventario con stock ha rotado.
          </Card>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Última venta</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Capital inmovilizado</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {stockMuerto.map((p) => (
                    <tr key={p.id_producto} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{p.nombre}</p>
                        {p.sku && <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{p.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{p.stock}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(p.ultima_venta)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(p.capital_inmovilizado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Rentabilidad
