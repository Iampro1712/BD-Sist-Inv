import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Loader, Modal } from '../ui'
import { useProductos } from '../../hooks/useProductos'
import { useToast } from '../../hooks/useToast'
import {
  useOrdenTaller, useCambiarEstadoOrden, useEntregarOrden,
  useAgregarRepuesto, useEliminarRepuesto, usePresupuestarOrden,
} from '../../hooks/useTaller'
import PresupuestoForm from '../forms/PresupuestoForm'
import { generarCotizacionPDF } from '../../utils/exportReportes'
import api from '../../services/api'
import { extraerMensajeError } from '../../utils/errores'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/** El backend anida los errores de validación en error.details. */

export const ESTADO_LABEL = {
  agendada: 'Agendada',
  recibida: 'Recibida',
  en_diagnostico: 'En diagnóstico',
  en_reparacion: 'En reparación',
  esperando_repuesto: 'Esperando repuesto',
  lista: 'Lista para entrega',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
}

export const ESTADO_COLOR = {
  agendada: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  recibida: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  en_diagnostico: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  en_reparacion: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  esperando_repuesto: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  lista: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  entregada: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  cancelada: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

const OrdenTrabajoDetalle = ({ idServicio, onClose }) => {
  const { data: orden, isLoading } = useOrdenTaller(idServicio)
  const toast = useToast()

  const [busqueda, setBusqueda] = useState('')
  const [repuesto, setRepuesto] = useState({ id_producto: '', cantidad: 1 })
  const [notasPaso, setNotasPaso] = useState('')
  const [preventivo, setPreventivo] = useState({ meses: '', km: '' })
  const [modalPresupuesto, setModalPresupuesto] = useState(false)

  const { data: productosData } = useProductos({ search: busqueda, page_size: 20 })
  const productos = lista(productosData)

  const cambiarEstado = useCambiarEstadoOrden()
  const entregar = useEntregarOrden()
  const agregarRepuesto = useAgregarRepuesto()
  const eliminarRepuesto = useEliminarRepuesto()
  const presupuestar = usePresupuestarOrden()

  if (isLoading || !orden) {
    return <div className="py-12 flex justify-center"><Loader /></div>
  }

  const cerrada = orden.estado === 'entregada' || orden.estado === 'cancelada'
  const transiciones = (orden.transiciones_posibles || []).filter((e) => e !== 'entregada')
  const puedeEntregar = (orden.transiciones_posibles || []).includes('entregada')

  const handleCambiarEstado = (estado) => {
    cambiarEstado.mutate(
      { id: idServicio, estado, notas: notasPaso || undefined },
      {
        onSuccess: () => {
          toast.success(`Orden movida a "${ESTADO_LABEL[estado] || estado}"`)
          setNotasPaso('')
        },
        onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo cambiar el estado')),
      }
    )
  }

  const handleAgregarRepuesto = () => {
    if (!repuesto.id_producto) {
      toast.error('Elegí un repuesto')
      return
    }
    agregarRepuesto.mutate(
      { id: idServicio, id_producto: parseInt(repuesto.id_producto), cantidad: parseInt(repuesto.cantidad) || 1 },
      {
        onSuccess: () => {
          toast.success('Repuesto agregado y descontado del inventario')
          setRepuesto({ id_producto: '', cantidad: 1 })
          setBusqueda('')
        },
        onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo agregar el repuesto')),
      }
    )
  }

  const handleEliminarRepuesto = (repuestoId) => {
    eliminarRepuesto.mutate(
      { id: idServicio, repuestoId },
      {
        onSuccess: () => toast.success('Repuesto quitado, stock restituido'),
        onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo quitar el repuesto')),
      }
    )
  }

  const handlePresupuestar = (datos) => {
    presupuestar.mutate(
      { id: idServicio, ...datos },
      {
        onSuccess: (res) => {
          toast.success(`Presupuesto #${res.data.id_cotizacion} creado`)
          setModalPresupuesto(false)
          // Se descarga de una: el PDF es lo que se le manda al cliente.
          generarCotizacionPDF(res.data)
        },
        onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo crear el presupuesto')),
      }
    )
  }

  const handleDescargarPresupuesto = async () => {
    try {
      const { data } = await api.get(`/cotizaciones/${orden.presupuesto.id_cotizacion}/`)
      await generarCotizacionPDF(data)
    } catch (err) {
      toast.error(extraerMensajeError(err, 'No se pudo generar el PDF'))
    }
  }

  const handleEntregar = () => {
    entregar.mutate(
      {
        id: idServicio,
        notas: notasPaso || undefined,
        proximo_mantenimiento_meses: preventivo.meses || undefined,
        proximo_mantenimiento_km: preventivo.km || undefined,
      },
      {
        onSuccess: (res) => {
          toast.success(`Entregada. Venta #${res.data.id_venta} generada por ${formatCurrency(res.data.total)}`)
          setNotasPaso('')
        },
        onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo entregar la orden')),
      }
    )
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              OT #{orden.id_servicio}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[orden.estado] || ''}`}>
              {orden.estado_display || ESTADO_LABEL[orden.estado]}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
            {orden.tipo_servicio}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {orden.moto_info} · {orden.cliente_nombre}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(orden.costo)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mano de obra {formatCurrency(orden.precio_mano_obra)} + repuestos {formatCurrency(orden.total_repuestos)}
          </p>
        </div>
      </div>

      {/* Datos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Ingreso</p>
          <p className="text-gray-900 dark:text-white">{formatDate(orden.fecha_servicio)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Mecánico</p>
          <p className="text-gray-900 dark:text-white">{orden.mecanico_nombre || 'Sin asignar'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Días en taller</p>
          <p className="text-gray-900 dark:text-white">{orden.dias_en_taller ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Kilometraje</p>
          <p className="text-gray-900 dark:text-white">
            {orden.km_actual ? `${orden.km_actual.toLocaleString('es-NI')} km` : '—'}
          </p>
        </div>
      </div>

      {orden.descripcion && (
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Notas del ingreso</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{orden.descripcion}</p>
        </div>
      )}

      {/* Venta generada */}
      {orden.id_venta && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-green-800 dark:text-green-300">
            Facturada en la venta <strong>#{orden.id_venta}</strong>. El cobro se registra desde Ventas.
          </p>
          <Link to="/ventas"
            className="text-xs font-semibold text-green-700 dark:text-green-400 hover:underline whitespace-nowrap">
            Ir a Ventas →
          </Link>
        </div>
      )}

      {/* Presupuesto: la autorización del cliente para empezar a gastar */}
      {orden.presupuesto ? (
        <div className={`rounded-lg border p-3 ${
          orden.presupuesto.estado === 'aprobada' || orden.presupuesto.estado === 'convertida'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : orden.presupuesto.estado === 'rechazada'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Presupuesto #{orden.presupuesto.id_cotizacion} · {orden.presupuesto.estado_display}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {formatCurrency(orden.presupuesto.total)}
                {orden.presupuesto.vencido && ' · vencido'}
                {orden.presupuesto.estado === 'pendiente' && ' · esperando respuesta del cliente'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDescargarPresupuesto}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Descargar PDF
              </button>
              <Link to="/cotizaciones"
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap">
                Aprobar o rechazar →
              </Link>
            </div>
          </div>
          {!orden.reparacion_autorizada && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              No se puede pasar a reparación hasta que el cliente autorice el presupuesto.
            </p>
          )}
        </div>
      ) : !cerrada && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sin presupuesto. Podés cotizarle el trabajo al cliente antes de empezar.
          </p>
          <Button type="button" variant="secondary" onClick={() => setModalPresupuesto(true)}>
            Presupuestar
          </Button>
        </div>
      )}

      {/* Repuestos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Repuestos usados</h4>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Descuentan del inventario al agregarse
          </span>
        </div>

        {(orden.repuestos || []).length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2">Todavía no se usó ningún repuesto.</p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
            {orden.repuestos.map((r) => (
              <div key={r.id_servicio_repuesto} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{r.producto_nombre}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {r.cantidad} x {formatCurrency(r.precio_unitario)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(r.subtotal)}
                  </span>
                  {!cerrada && (
                    <button onClick={() => handleEliminarRepuesto(r.id_servicio_repuesto)}
                      disabled={eliminarRepuesto.isPending}
                      className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Quitar y devolver al inventario">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!cerrada && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar repuesto..." className={`sm:col-span-4 ${inputCls}`} />
            <select value={repuesto.id_producto}
              onChange={(e) => setRepuesto((p) => ({ ...p, id_producto: e.target.value }))}
              className={`sm:col-span-5 ${inputCls}`}>
              <option value="">Selecciona el repuesto...</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto} disabled={p.cantidad_actual <= 0}>
                  {p.nombre} — stock {p.cantidad_actual} — {formatCurrency(p.precio_final)}
                </option>
              ))}
            </select>
            <input type="number" min="1" value={repuesto.cantidad}
              onChange={(e) => setRepuesto((p) => ({ ...p, cantidad: e.target.value }))}
              className={`sm:col-span-1 ${inputCls}`} />
            <Button type="button" onClick={handleAgregarRepuesto}
              disabled={agregarRepuesto.isPending} className="sm:col-span-2">
              {agregarRepuesto.isPending ? '...' : 'Agregar'}
            </Button>
          </div>
        )}
      </div>

      {/* Avance de estado */}
      {!cerrada && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Avanzar el trabajo</h4>
          <textarea value={notasPaso} onChange={(e) => setNotasPaso(e.target.value)} rows={2}
            placeholder="Notas de este paso (quedan en la bitácora)..." className={inputCls} />

          <div className="flex flex-wrap gap-2">
            {transiciones.map((estado) => (
              <Button key={estado} type="button" variant="secondary"
                onClick={() => handleCambiarEstado(estado)} disabled={cambiarEstado.isPending}>
                {ESTADO_LABEL[estado] || estado}
              </Button>
            ))}
            {transiciones.length === 0 && !puedeEntregar && (
              <p className="text-sm text-gray-400 dark:text-gray-500">No hay más pasos disponibles.</p>
            )}
          </div>

          {puedeEntregar && (
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3 space-y-3">
              <p className="text-sm text-teal-800 dark:text-teal-300">
                Al entregar se genera la venta por {formatCurrency(orden.costo)} (mano de obra + repuestos),
                que queda pendiente de cobro.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Próximo mantenimiento (meses)
                  </label>
                  <input type="number" min="1" value={preventivo.meses}
                    onChange={(e) => setPreventivo((p) => ({ ...p, meses: e.target.value }))}
                    placeholder="Ej: 3" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Próximo mantenimiento (km)
                  </label>
                  <input type="number" min="0" value={preventivo.km}
                    onChange={(e) => setPreventivo((p) => ({ ...p, km: e.target.value }))}
                    placeholder="Ej: 15000" className={inputCls} />
                </div>
              </div>
              <Button type="button" onClick={handleEntregar} disabled={entregar.isPending}>
                {entregar.isPending ? 'Entregando...' : 'Entregar y facturar'}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
      </div>

      <Modal isOpen={modalPresupuesto} onClose={() => setModalPresupuesto(false)}
        title="Presupuestar reparación" size="lg">
        <PresupuestoForm orden={orden} diagnosticoSugerido={orden.descripcion || ''}
          onSubmit={handlePresupuestar} onCancel={() => setModalPresupuesto(false)}
          isLoading={presupuestar.isPending} />
      </Modal>
    </div>
  )
}

export default OrdenTrabajoDetalle
