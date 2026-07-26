import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { useCuentasPagar } from '../hooks/useCuentasPagar'
import { Card } from '../components/ui'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

const bucketBadge = (bucket) => {
  const map = {
    '0-30':  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    '31-60': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    '61-90': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    '90+':   'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  }
  return map[bucket] || 'bg-gray-100 text-gray-600'
}

const CuentasPagar = () => {
  const { data, isLoading, error } = useCuentasPagar()

  const cuentas = data?.cuentas || []
  const aging = data?.aging || { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cuentas por Pagar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Compras con saldo pendiente al proveedor, ordenadas por antigüedad de la deuda
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar cuentas por pagar: {error.message}
        </div>
      )}

      {/* Tarjetas resumen */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Total por pagar</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(data?.total_por_pagar)}
            </p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Compras con saldo</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.num_ordenes || 0}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Proveedores</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.num_proveedores || 0}</p>
          </Card>
        </motion.div>
      </motion.div>

      {/* Aging */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: '0-30',  label: 'Al día (0-30 días)', color: 'text-green-600 dark:text-green-400' },
          { key: '31-60', label: '31-60 días',         color: 'text-yellow-600 dark:text-yellow-400' },
          { key: '61-90', label: '61-90 días',         color: 'text-orange-600 dark:text-orange-400' },
          { key: '90+',   label: 'Más de 90 días',     color: 'text-red-600 dark:text-red-400' },
        ].map((b) => (
          <motion.div key={b.key} variants={fadeIn}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{b.label}</p>
            <p className={`text-lg font-bold ${b.color}`}>{formatCurrency(aging[b.key])}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabla */}
      {isLoading ? (
        <Card className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </Card>
      ) : cuentas.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">¡Sin deudas pendientes!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No hay compras con dinero por pagar.</p>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Compra</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Antigüedad</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {cuentas.map((c) => (
                  <motion.tr key={c.id_orden} variants={fadeIn}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        #{c.id_orden}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.proveedor}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(c.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bucketBadge(c.bucket)}`}>
                        {c.dias} días
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(c.saldo_pendiente)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default CuentasPagar
