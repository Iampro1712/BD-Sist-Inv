import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { backupService } from '../services/backup.service'
import { useToast } from '../hooks/useToast'
import { Button, Card } from '../components/ui'

const Respaldos = () => {
  const [loading, setLoading] = useState(false)
  const [ultimo, setUltimo] = useState(null)
  const toast = useToast()

  const handleDescargar = async () => {
    setLoading(true)
    try {
      const res = await backupService.descargar()

      // Nombre de archivo desde Content-Disposition, con respaldo
      const cd = res.headers?.['content-disposition'] || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : `inventrix-backup-${new Date().toISOString().slice(0, 10)}.json`

      const blob = new Blob([res.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      setUltimo(new Date())
      toast.success('Respaldo descargado correctamente')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al generar el respaldo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Respaldos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Descarga una copia de seguridad completa de tus datos con un clic
        </p>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
        {/* Tarjeta principal de descarga */}
        <motion.div variants={fadeIn}>
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M12 11v6m0 0l-3-3m3 3l3-3" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Respaldo completo</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-md">
                    Genera un archivo <span className="font-mono text-xs">.json</span> con todas tus tablas
                    (productos, clientes, ventas, pagos, compras, cotizaciones, devoluciones, etc.).
                  </p>
                  {ultimo && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      ✓ Último respaldo descargado: {ultimo.toLocaleString('es-NI')}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={handleDescargar} loading={loading} disabled={loading} className="shrink-0">
                {loading ? 'Generando...' : 'Descargar respaldo'}
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Recomendaciones */}
        <motion.div variants={fadeIn}>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-3">
              Recomendaciones
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex gap-2">
                <span className="text-primary-500 shrink-0">•</span>
                Descarga un respaldo <strong>al menos una vez por semana</strong>, o tras un día de muchas ventas.
              </li>
              <li className="flex gap-2">
                <span className="text-primary-500 shrink-0">•</span>
                Guarda el archivo en un lugar seguro (Google Drive, una USB o tu correo).
              </li>
              <li className="flex gap-2">
                <span className="text-primary-500 shrink-0">•</span>
                El archivo es un volcado de datos; consérvalo para restaurar tu información si algo falla.
              </li>
            </ul>
          </Card>
        </motion.div>

        {/* Nota sobre automatización */}
        <motion.div variants={fadeIn}>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex gap-3">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Para respaldos <strong>automáticos programados</strong> (sin descargar a mano) se requiere
              configurar una tarea en el servidor. Mientras tanto, este respaldo manual te protege ante pérdidas de datos.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Respaldos
