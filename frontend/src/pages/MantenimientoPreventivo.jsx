import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { useMantenimientoPreventivo } from '../hooks/useTaller'
import { Card } from '../components/ui'

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-NI', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  }) : '—'

/** Link wa.me con el recordatorio de mantenimiento pre-armado. */
const whatsappLink = (m) => {
  if (!m.telefono) return null
  const tel = String(m.telefono).replace(/\D/g, '')
  if (!tel) return null
  const numero = tel.length === 8 ? `505${tel}` : tel  // Nicaragua: 8 dígitos
  const cuando = m.vencido
    ? `ya le toca desde el ${formatDate(m.proxima_fecha)}`
    : `le toca el ${formatDate(m.proxima_fecha)}`
  const msg = `Hola ${m.cliente}, le recordamos que a su ${m.moto} (placa ${m.placa}) ${cuando} su mantenimiento. ¿Le agendamos una cita? ¡Gracias!`
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`
}

const MantenimientoPreventivo = () => {
  const { data, isLoading, error } = useMantenimientoPreventivo()
  const motos = data?.motos || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Mantenimiento Preventivo
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Motos a las que ya les toca revisión, según lo sugerido al entregar su último servicio
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar el mantenimiento preventivo: {error.message}
        </div>
      )}

      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Por contactar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.total || 0}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Ya vencidos</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data?.vencidos || 0}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Próximos 30 días</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data?.proximos || 0}</p>
          </Card>
        </motion.div>
      </motion.div>

      {isLoading ? (
        <Card className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </Card>
      ) : motos.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nada por recordar</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            No hay motos con mantenimiento pendiente en los próximos 30 días.
          </p>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Moto</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Último servicio</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Le toca</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Avisar</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {motos.map((m) => {
                  const wa = whatsappLink(m)
                  return (
                    <motion.tr key={m.id_servicio} variants={fadeIn}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{m.moto}</div>
                        <div className="text-xs font-mono text-gray-500 dark:text-gray-400">{m.placa}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{m.cliente}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">{formatDate(m.ultimo_servicio)}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{m.ultimo_tipo}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">{formatDate(m.proxima_fecha)}</div>
                        {m.proximo_km && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            o a los {m.proximo_km.toLocaleString('es-NI')} km
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {m.vencido ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            Vencido {m.dias_vencido}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            En {Math.abs(m.dias_vencido)}d
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                            title="Enviar recordatorio por WhatsApp">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.347-.347.52-.52.174-.174.232-.298.347-.497.116-.198.058-.371-.03-.52-.086-.148-.66-1.59-.904-2.178-.238-.571-.48-.49-.66-.499a11.6 11.6 0 0 0-.612-.011c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                            </svg>
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Sin teléfono</span>
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

export default MantenimientoPreventivo
