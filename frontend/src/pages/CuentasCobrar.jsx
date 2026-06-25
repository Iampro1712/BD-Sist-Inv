import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { useCuentasCobrar } from '../hooks/useCuentasCobrar'
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

/** Genera un link wa.me con un recordatorio de saldo pre-armado. */
const whatsappLink = (cuenta) => {
  if (!cuenta.telefono) return null
  const tel = String(cuenta.telefono).replace(/\D/g, '')
  if (!tel) return null
  const numero = tel.length === 8 ? `505${tel}` : tel  // Nicaragua: 8 dígitos
  const msg = `Hola ${cuenta.cliente}, le recordamos su saldo pendiente de ${formatCurrency(cuenta.saldo_pendiente)} de la venta #${cuenta.id_venta}. ¡Gracias!`
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`
}

const CuentasCobrar = () => {
  const { data, isLoading, error } = useCuentasCobrar()

  const cuentas = data?.cuentas || []
  const aging = data?.aging || { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cuentas por Cobrar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ventas con saldo pendiente, ordenadas por antigüedad de la deuda
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar cuentas por cobrar: {error.message}
        </div>
      )}

      {/* Tarjetas resumen */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Total por cobrar</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(data?.total_por_cobrar)}
            </p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Ventas con saldo</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.num_ventas || 0}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Clientes deudores</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.num_clientes || 0}</p>
          </Card>
        </motion.div>
      </motion.div>

      {/* Aging */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: '0-30',  label: 'Al día (0-30 días)',   color: 'text-green-600 dark:text-green-400' },
          { key: '31-60', label: '31-60 días',           color: 'text-yellow-600 dark:text-yellow-400' },
          { key: '61-90', label: '61-90 días',           color: 'text-orange-600 dark:text-orange-400' },
          { key: '90+',   label: 'Más de 90 días',       color: 'text-red-600 dark:text-red-400' },
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">¡Sin saldos pendientes!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No hay ventas con dinero por cobrar.</p>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Venta</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Antigüedad</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recordar</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {cuentas.map((c) => {
                  const wa = whatsappLink(c)
                  return (
                    <motion.tr key={c.id_venta} variants={fadeIn}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          #{c.id_venta}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.cliente}</td>
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 hover:underline"
                            title="Recordar por WhatsApp">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.207z" />
                            </svg>
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">sin teléfono</span>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default CuentasCobrar
