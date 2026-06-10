import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGarantias, useGarantia } from '../hooks/useGarantias'
import { useCreateReclamacion, useResolverReclamacion } from '../hooks/useReclamaciones'
import { useToast } from '../hooks/useToast'
import Modal from '../components/ui/Modal'
import { Badge, Card, Button } from '../components/ui'
import { staggerContainer, fadeIn } from '../utils/animations'

const ESTADO_BADGE = {
  activa: 'success',
  vencida: 'default',
  reclamada: 'warning',
}

const ESTADO_LABEL = {
  activa: 'Activa',
  vencida: 'Vencida',
  reclamada: 'Reclamada',
}

const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }) : '-'

const Garantias = () => {
  const [estadoFilter, setEstadoFilter] = useState('')
  const [selectedGarantiaId, setSelectedGarantiaId] = useState(null)
  const [isDetalleOpen, setIsDetalleOpen] = useState(false)
  const [isReclamarOpen, setIsReclamarOpen] = useState(false)
  const [isResolverOpen, setIsResolverOpen] = useState(false)
  const [selectedReclamacionId, setSelectedReclamacionId] = useState(null)
  const [descripcionProblema, setDescripcionProblema] = useState('')
  const [resolucionTexto, setResolucionTexto] = useState('')

  const toast = useToast()

  const { data: garantiasData, isLoading } = useGarantias({ estado: estadoFilter })
  const { data: garantiaDetalle } = useGarantia(selectedGarantiaId)
  const createReclamacion = useCreateReclamacion()
  const resolverReclamacion = useResolverReclamacion()

  const garantias = garantiasData?.results || garantiasData || []
  const totalActivas = garantias.filter(g => g.estado === 'activa').length
  const totalVencidas = garantias.filter(g => g.estado === 'vencida').length
  const totalReclamadas = garantias.filter(g => g.estado === 'reclamada').length

  const handleVerDetalle = (id) => {
    setSelectedGarantiaId(id)
    setIsDetalleOpen(true)
  }

  const handleReclamar = (id) => {
    setSelectedGarantiaId(id)
    setDescripcionProblema('')
    setIsReclamarOpen(true)
  }

  const handleSubmitReclamacion = async () => {
    if (!descripcionProblema.trim()) return
    try {
      await createReclamacion.mutateAsync({
        garantia: selectedGarantiaId,
        descripcion_problema: descripcionProblema,
      })
      toast.success('Reclamación registrada exitosamente')
      setIsReclamarOpen(false)
      setDescripcionProblema('')
    } catch (err) {
      toast.error(err.response?.data?.garantia?.[0] || err.response?.data?.detail || 'Error al registrar reclamación')
    }
  }

  const handleResolver = (reclamacionId) => {
    setSelectedReclamacionId(reclamacionId)
    setResolucionTexto('')
    setIsResolverOpen(true)
  }

  const handleSubmitResolucion = async () => {
    if (!resolucionTexto.trim()) return
    try {
      await resolverReclamacion.mutateAsync({ id: selectedReclamacionId, resolucion: resolucionTexto })
      toast.success('Reclamación resuelta exitosamente')
      setIsResolverOpen(false)
      setResolucionTexto('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al resolver reclamación')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Garantías</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Gestión de garantías y reclamaciones de productos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Activas', value: totalActivas, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
          { label: 'Vencidas', value: totalVencidas, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
          { label: 'Con reclamación', value: totalReclamadas, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</p>
            {isLoading
              ? <div className="h-7 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
              : <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
            }
          </div>
        ))}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {['', 'activa', 'vencida', 'reclamada'].map(estado => (
            <button
              key={estado}
              onClick={() => setEstadoFilter(estado)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                estadoFilter === estado
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {estado === '' ? 'Todas' : ESTADO_LABEL[estado]}
            </button>
          ))}
        </div>
      </Card>

      {/* Tabla */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : garantias.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">No hay garantías</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {estadoFilter ? `No hay garantías con estado "${ESTADO_LABEL[estadoFilter]}"` : 'Las garantías se generan automáticamente al registrar ventas de productos con garantía'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Período</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {garantias.map(g => (
                  <motion.tr key={g.id_garantia} variants={fadeIn} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{g.producto_nombre}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">{g.producto_sku}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 dark:text-white">{g.cliente_nombre || `Cliente #${g.id_cliente}`}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Venta #{g.id_venta}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 dark:text-white">{formatDate(g.fecha_inicio)} → {formatDate(g.fecha_fin)}</p>
                      {g.dias_restantes !== null && g.estado === 'activa' && (
                        <p className={`text-xs mt-0.5 ${g.dias_restantes <= 30 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {g.dias_restantes === 0 ? 'Vence hoy' : `${g.dias_restantes} días restantes`}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={ESTADO_BADGE[g.estado]}>{ESTADO_LABEL[g.estado]}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleVerDetalle(g.id_garantia)}
                          title="Ver detalle"
                          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {g.estado === 'activa' && (
                          <button
                            onClick={() => handleReclamar(g.id_garantia)}
                            title="Registrar reclamación"
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Modal detalle garantía */}
      <Modal isOpen={isDetalleOpen} onClose={() => setIsDetalleOpen(false)} title="Detalle de Garantía" size="lg">
        {garantiaDetalle && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Producto', value: garantiaDetalle.producto_nombre },
                { label: 'SKU', value: garantiaDetalle.producto_sku },
                { label: 'Cliente', value: garantiaDetalle.cliente_nombre || `#${garantiaDetalle.id_cliente}` },
                { label: 'Venta', value: `#${garantiaDetalle.id_venta}` },
                { label: 'Inicio', value: formatDate(garantiaDetalle.fecha_inicio) },
                { label: 'Vencimiento', value: formatDate(garantiaDetalle.fecha_fin) },
                { label: 'Duración', value: `${garantiaDetalle.meses_garantia} meses` },
                { label: 'Tipo', value: garantiaDetalle.tipo_garantia || '-' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Estado:</span>
              <Badge variant={ESTADO_BADGE[garantiaDetalle.estado]}>{ESTADO_LABEL[garantiaDetalle.estado]}</Badge>
            </div>

            {garantiaDetalle.reclamaciones?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Reclamaciones</h4>
                <div className="space-y-2">
                  {garantiaDetalle.reclamaciones.map(r => (
                    <div key={r.id_reclamacion} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(r.fecha_reclamacion)}</p>
                        <Badge variant={r.estado === 'resuelto' ? 'success' : r.estado === 'rechazado' ? 'danger' : 'warning'}>
                          {r.estado}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-white">{r.descripcion_problema}</p>
                      {r.resolucion && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">Resolución: {r.resolucion}</p>
                      )}
                      {(r.estado === 'pendiente' || r.estado === 'en_proceso') && (
                        <button
                          onClick={() => { setIsDetalleOpen(false); handleResolver(r.id_reclamacion) }}
                          className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Marcar como resuelto →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {garantiaDetalle.estado === 'activa' && (
              <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="secondary"
                  onClick={() => { setIsDetalleOpen(false); handleReclamar(garantiaDetalle.id_garantia) }}
                >
                  Registrar reclamación
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal registrar reclamación */}
      <Modal isOpen={isReclamarOpen} onClose={() => setIsReclamarOpen(false)} title="Registrar Reclamación" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Describe el problema o defecto del producto para registrar la reclamación de garantía.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Descripción del problema *</label>
            <textarea
              value={descripcionProblema}
              onChange={e => setDescripcionProblema(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-colors"
              placeholder="Ej: El producto presenta falla en el mecanismo principal..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsReclamarOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmitReclamacion}
              loading={createReclamacion.isPending}
              disabled={!descripcionProblema.trim() || createReclamacion.isPending}
            >
              Registrar reclamación
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal resolver reclamación */}
      <Modal isOpen={isResolverOpen} onClose={() => setIsResolverOpen(false)} title="Resolver Reclamación" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Describe cómo se resolvió el problema para cerrar la reclamación.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Resolución *</label>
            <textarea
              value={resolucionTexto}
              onChange={e => setResolucionTexto(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-colors"
              placeholder="Ej: Se realizó cambio del producto defectuoso..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsResolverOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmitResolucion}
              loading={resolverReclamacion.isPending}
              disabled={!resolucionTexto.trim() || resolverReclamacion.isPending}
            >
              Marcar como resuelto
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Garantias
