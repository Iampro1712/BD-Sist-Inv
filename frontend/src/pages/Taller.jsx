import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { Button, Card, Loader, Modal } from '../components/ui'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../hooks/useAuthStore'
import {
  useOrdenesTaller, useAgendarServicio, useCambiarEstadoOrden, useReporteAgendaTaller,
} from '../hooks/useTaller'
import AgendarServicioForm from '../components/forms/AgendarServicioForm'
import OrdenTrabajoDetalle, { ESTADO_LABEL } from '../components/taller/OrdenTrabajoDetalle'
import { extraerMensajeError } from '../utils/errores'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

/** Columnas del tablero, en el orden en que avanza el trabajo. */
const COLUMNAS = [
  { estado: 'agendada', accent: 'border-t-gray-400' },
  { estado: 'recibida', accent: 'border-t-blue-500' },
  { estado: 'en_diagnostico', accent: 'border-t-indigo-500' },
  { estado: 'en_reparacion', accent: 'border-t-amber-500' },
  { estado: 'esperando_repuesto', accent: 'border-t-orange-500' },
  { estado: 'lista', accent: 'border-t-teal-500' },
]

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])


const Taller = () => {
  const [modalAgendar, setModalAgendar] = useState(false)
  const [ordenAbierta, setOrdenAbierta] = useState(null)
  const [arrastrando, setArrastrando] = useState(null)
  const [columnaActiva, setColumnaActiva] = useState(null)

  const toast = useToast()
  const esAdmin = useAuthStore((s) => s.user?.is_staff)
  // El tablero solo muestra lo que está en curso.
  const { data, isLoading, error } = useOrdenesTaller({ activas: 'true', page_size: 200 })
  const { data: reporte } = useReporteAgendaTaller(esAdmin)
  const agendar = useAgendarServicio()
  const cambiarEstado = useCambiarEstadoOrden()

  const ordenes = lista(data)

  const porEstado = useMemo(() => {
    const mapa = {}
    COLUMNAS.forEach((c) => { mapa[c.estado] = [] })
    ordenes.forEach((o) => {
      if (mapa[o.estado]) mapa[o.estado].push(o)
    })
    return mapa
  }, [ordenes])

  const totalEnTaller = ordenes.reduce((acc, o) => acc + parseFloat(o.costo || 0), 0)

  const handleAgendar = (datos) => {
    agendar.mutate(datos, {
      onSuccess: () => {
        toast.success('Servicio agendado')
        setModalAgendar(false)
      },
      onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo agendar el servicio')),
    })
  }

  const handleSoltar = (estadoDestino) => {
    setColumnaActiva(null)
    const orden = arrastrando
    setArrastrando(null)
    if (!orden || orden.estado === estadoDestino) return

    // Entregar genera la venta, así que no puede hacerse arrastrando.
    if (estadoDestino === 'entregada') return

    if (!(orden.transiciones_posibles || []).includes(estadoDestino)) {
      toast.error(`No se puede pasar de "${ESTADO_LABEL[orden.estado]}" a "${ESTADO_LABEL[estadoDestino]}"`)
      return
    }

    cambiarEstado.mutate(
      { id: orden.id_servicio, estado: estadoDestino },
      {
        onSuccess: () => toast.success(`OT #${orden.id_servicio} → ${ESTADO_LABEL[estadoDestino]}`),
        onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo mover la orden')),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Taller</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Órdenes de trabajo en curso. Arrastrá una tarjeta para avanzarla de estado.
          </p>
        </div>
        <Button onClick={() => setModalAgendar(true)}>Agendar servicio</Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar el taller: {error.message}
        </div>
      )}

      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Órdenes abiertas</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{ordenes.length}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Monto en taller</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalEnTaller)}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Listas para entregar</p>
            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {(porEstado.lista || []).length}
            </p>
          </Card>
        </motion.div>
      </motion.div>

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader /></div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {COLUMNAS.map((col) => {
              const items = porEstado[col.estado] || []
              const esDestinoValido =
                arrastrando && (arrastrando.transiciones_posibles || []).includes(col.estado)
              return (
                <div key={col.estado}
                  onDragOver={(e) => {
                    if (esDestinoValido) { e.preventDefault(); setColumnaActiva(col.estado) }
                  }}
                  onDragLeave={() => setColumnaActiva((c) => (c === col.estado ? null : c))}
                  onDrop={() => handleSoltar(col.estado)}
                  className={`w-72 shrink-0 rounded-xl border-t-4 ${col.accent} bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 transition-colors ${
                    columnaActiva === col.estado ? 'ring-2 ring-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : ''
                  } ${arrastrando && !esDestinoValido ? 'opacity-50' : ''}`}>
                  <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {ESTADO_LABEL[col.estado]}
                    </h3>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>

                  <div className="p-2 space-y-2 min-h-[120px]">
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">Vacío</p>
                    ) : (
                      items.map((o) => (
                        <div key={o.id_servicio} draggable
                          onDragStart={() => setArrastrando(o)}
                          onDragEnd={() => { setArrastrando(null); setColumnaActiva(null) }}
                          onClick={() => setOrdenAbierta(o.id_servicio)}
                          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono font-semibold text-gray-400 dark:text-gray-500">
                              OT #{o.id_servicio}
                            </span>
                            {o.dias_en_taller != null && (
                              <span className={`text-[11px] font-semibold ${
                                o.dias_en_taller > 7 ? 'text-red-600 dark:text-red-400'
                                  : o.dias_en_taller > 3 ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}>
                                {o.dias_en_taller}d
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {o.tipo_servicio}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{o.moto_info}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{o.cliente_nombre}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {formatCurrency(o.costo)}
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[110px]">
                              {o.mecanico_nombre || 'Sin asignar'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Carga del taller: solo admin (el reporte es admin-only en el backend) */}
      {esAdmin && reporte && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div variants={fadeIn}>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Carga por mecánico
              </h3>
              {(reporte.por_mecanico || []).length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Sin órdenes abiertas.</p>
              ) : (
                <div className="space-y-2">
                  {reporte.por_mecanico.map((m) => (
                    <div key={m.id_mecanico ?? 'sin-asignar'}
                      className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{m.mecanico}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-gray-500 dark:text-gray-400">
                          {m.ordenes_abiertas} {m.ordenes_abiertas === 1 ? 'orden' : 'órdenes'}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(m.monto)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Tiempo promedio por estado
              </h3>
              {(reporte.por_estado || []).length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Sin órdenes abiertas.</p>
              ) : (
                <div className="space-y-2">
                  {reporte.por_estado.map((e) => (
                    <div key={e.estado} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {ESTADO_LABEL[e.estado] || e.estado}
                      </span>
                      <span className={`font-semibold ${
                        e.dias_promedio > 7 ? 'text-red-600 dark:text-red-400'
                          : e.dias_promedio > 3 ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {e.dias_promedio} días
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Entregadas este mes</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {reporte.entregadas_mes} · {formatCurrency(reporte.facturado_mes)}
                </span>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}

      <Modal isOpen={modalAgendar} onClose={() => setModalAgendar(false)}
        title="Agendar servicio" size="lg">
        <AgendarServicioForm onSubmit={handleAgendar} onCancel={() => setModalAgendar(false)}
          isLoading={agendar.isPending} />
      </Modal>

      <Modal isOpen={!!ordenAbierta} onClose={() => setOrdenAbierta(null)}
        title="Orden de trabajo" size="lg">
        {ordenAbierta && (
          <OrdenTrabajoDetalle idServicio={ordenAbierta} onClose={() => setOrdenAbierta(null)} />
        )}
      </Modal>
    </div>
  )
}

export default Taller
