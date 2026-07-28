import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  useOrdenesCompra,
  useOrdenCompra,
  useCreateOrdenCompra,
  useConfirmarOrdenCompra,
  useRecibirOrdenCompra,
  useCancelarOrdenCompra
} from '../hooks/useOrdenesCompra'
import { useProveedores } from '../hooks/useProveedores'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import SearchBar from '../components/forms/SearchBar'
import OrdenCompraForm from '../components/forms/OrdenCompraForm'
import OrdenCompraDetalle from '../components/ordenes/OrdenCompraDetalle'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ProveedorLogo from '../components/ui/ProveedorLogo'
import { Button, Badge, Loader, Card } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const ESTADOS = [
  { value: '',          label: 'Todos',     dot: 'bg-gray-400' },
  { value: 'pendiente', label: 'Pendiente', dot: 'bg-yellow-400' },
  { value: 'recibida',  label: 'Recibida',  dot: 'bg-green-400' },
  { value: 'cancelada', label: 'Cancelada', dot: 'bg-red-400' },
]

const estadoConfig = {
  pendiente: { badge: 'warning', label: 'Pendiente', icon: '🕐' },
  recibida:  { badge: 'success', label: 'Recibida',  icon: '📦' },
  cancelada: { badge: 'danger',  label: 'Cancelada', icon: '✖' },
}

/** Saca el mensaje que manda el backend, que explica el motivo real del rechazo. */
const mensajeError = (err, fallback) => {
  const data = err?.response?.data
  const message = data?.error?.message
  if (typeof message === 'string') return message
  if (typeof data?.error === 'string') return data.error
  const details = data?.error?.details
  if (details && typeof details === 'object') {
    const primero = Object.values(details)[0]
    if (primero) return Array.isArray(primero) ? primero[0] : primero
  }
  return fallback
}

const pagoConfig = {
  pagado:    { label: 'Pagado',    cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  parcial:   { label: 'Parcial',   cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  pendiente: { label: 'Por pagar', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
}

const OrdenesCompra = () => {
  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [proveedorFiltro, setProveedorFiltro] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false)
  const [selectedOrdenId, setSelectedOrdenId] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null })

  const debouncedSearch = useDebounce(search, 500)
  const toast = useToast()

  const { data, isLoading, error } = useOrdenesCompra({
    search: debouncedSearch,
    estado: estadoFiltro || undefined,
    proveedor: proveedorFiltro || undefined,
    fecha_inicio: fechaInicio || undefined,
    fecha_fin: fechaFin || undefined,
    page,
  })

  const { data: ordenDetalle } = useOrdenCompra(selectedOrdenId)
  const { data: proveedoresData } = useProveedores()

  const createMutation    = useCreateOrdenCompra()
  const confirmarMutation = useConfirmarOrdenCompra()
  const recibirMutation   = useRecibirOrdenCompra()
  const cancelarMutation  = useCancelarOrdenCompra()

  const ordenes    = data?.results || []
  const totalCount = data?.count || 0
  const totalPages = totalCount ? Math.ceil(totalCount / 20) : 1
  const proveedores = proveedoresData?.results || []

  const hayFiltros = search || estadoFiltro || proveedorFiltro || fechaInicio || fechaFin

  const limpiarFiltros = () => {
    setSearch('')
    setEstadoFiltro('')
    setProveedorFiltro('')
    setFechaInicio('')
    setFechaFin('')
    setPage(1)
  }

  const handleOpenDetalle = (id) => { setSelectedOrdenId(id); setIsDetalleModalOpen(true) }
  const handleCloseDetalle = () => { setIsDetalleModalOpen(false); setSelectedOrdenId(null) }

  const handleSubmit = async (formData) => {
    try {
      await createMutation.mutateAsync(formData)
      setIsModalOpen(false)
      toast.success('Orden de compra creada exitosamente')
    } catch {
      toast.error('Error al crear la orden de compra')
    }
  }

  const handleConfirmar = async () => {
    try {
      await confirmarMutation.mutateAsync(selectedOrdenId)
      toast.success('Orden confirmada correctamente')
      setConfirmDialog({ open: false, type: null })
    } catch (err) {
      toast.error(mensajeError(err, 'Error al confirmar la orden'))
    }
  }

  const handleRecibir = async () => {
    try {
      const res = await recibirMutation.mutateAsync(selectedOrdenId)
      const d = res?.data || {}
      toast.success(d.unidades_ingresadas
        ? `Orden recibida: ${d.unidades_ingresadas} unidad(es) sumadas al inventario`
        : 'Orden recibida')
      setConfirmDialog({ open: false, type: null })
    } catch (err) {
      // El backend explica por qué no se pudo (por ejemplo, una orden vieja sin
      // cantidades registradas); tragarse ese mensaje dejaba al usuario a ciegas.
      toast.error(mensajeError(err, 'Error al recibir la orden'))
      setConfirmDialog({ open: false, type: null })
    }
  }

  const handleCancelar = async (motivo) => {
    try {
      await cancelarMutation.mutateAsync({ id: selectedOrdenId, motivo })
      toast.success('Orden cancelada')
    } catch {
      toast.error('Error al cancelar la orden')
    }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

  const isActionLoading = confirmarMutation.isPending || recibirMutation.isPending || cancelarMutation.isPending

  const counts = {
    pendiente: ordenes.filter(o => o.estado === 'pendiente').length,
    recibida:  ordenes.filter(o => o.estado === 'recibida').length,
    cancelada: ordenes.filter(o => o.estado === 'cancelada').length,
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Órdenes de Compra</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Gestión de compras a proveedores
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shrink-0">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Orden
        </Button>
      </div>

      {/* Filtro por estado — pill tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => { setEstadoFiltro(e.value); setPage(1) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              estadoFiltro === e.value
                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${e.dot}`} />
            {e.label}
          </button>
        ))}
      </div>

      {/* Barra de búsqueda y filtros secundarios */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Buscar por número de orden..."
            />
          </div>
          <select
            value={proveedorFiltro}
            onChange={(e) => { setProveedorFiltro(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => (
              <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre_empresa}</option>
            ))}
          </select>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => { setFechaInicio(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <span className="text-gray-400 text-sm shrink-0">—</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => { setFechaFin(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              Limpiar
            </button>
          )}
        </div>
        {hayFiltros && !isLoading && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {totalCount} resultado{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar órdenes: {error.message}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : ordenes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {hayFiltros ? 'Sin resultados' : 'No hay órdenes de compra'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {hayFiltros
              ? 'Intenta cambiar los filtros de búsqueda'
              : 'Crea tu primera orden de compra para empezar'}
          </p>
          {!hayFiltros && (
            <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
              Nueva Orden
            </Button>
          )}
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    # Orden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                    Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    Pago
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ordenes.map((orden) => {
                  const cfg = estadoConfig[orden.estado] || estadoConfig.pendiente
                  return (
                    <motion.tr
                      key={orden.id_orden}
                      variants={fadeIn}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          #{orden.id_orden}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ProveedorLogo nombreEmpresa={orden.proveedor_nombre} size="small" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {orden.proveedor_nombre}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(orden.fecha_creacion)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          orden.estado === 'recibida'  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          orden.estado === 'cancelada' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                                         'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            orden.estado === 'recibida'  ? 'bg-green-500' :
                            orden.estado === 'cancelada' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                          {cfg?.label ?? orden.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {/* El backend devuelve null a quien no es administrador:
                            cuánto se le compra a un proveedor es información de
                            dueño. Un C$0.00 acá sería un dato falso. */}
                        {orden.total != null ? (
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatCurrency(orden.total)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {orden.total > 0 && orden.estado !== 'cancelada' ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (pagoConfig[orden.estado_pago] || pagoConfig.pendiente).cls
                          }`}>
                            {(pagoConfig[orden.estado_pago] || pagoConfig.pendiente).label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleOpenDetalle(orden.id_orden)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          title="Ver detalle"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="bg-gray-50 dark:bg-gray-900/30 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Página <span className="font-medium text-gray-900 dark:text-white">{page}</span> de{' '}
                <span className="font-medium text-gray-900 dark:text-white">{totalPages}</span>
                <span className="ml-2 text-gray-400">({totalCount} total)</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Modal Nueva Orden */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nueva Orden de Compra" size="xl">
        <OrdenCompraForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={createMutation.isPending}
        />
      </Modal>

      {/* Modal Detalle */}
      <Modal isOpen={isDetalleModalOpen} onClose={handleCloseDetalle} title="Detalle de Orden" size="xl">
        {ordenDetalle && (
          <OrdenCompraDetalle
            orden={ordenDetalle}
            onConfirmar={() => setConfirmDialog({ open: true, type: 'confirmar' })}
            onRecibir={() => setConfirmDialog({ open: true, type: 'recibir' })}
            onCancelar={handleCancelar}
            isLoading={isActionLoading}
          />
        )}
      </Modal>

      {/* Confirmar acción */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, type: null })}
        onConfirm={confirmDialog.type === 'confirmar' ? handleConfirmar : handleRecibir}
        title={confirmDialog.type === 'confirmar' ? 'Confirmar orden' : 'Marcar como recibida'}
        message={
          confirmDialog.type === 'confirmar'
            ? '¿Confirmas esta orden de compra? Se notificará al proveedor.'
            : '¿Marcar la orden como recibida? Esto actualizará el stock de los productos automáticamente.'
        }
        confirmText={confirmDialog.type === 'confirmar' ? 'Confirmar' : 'Sí, marcar recibida'}
        cancelText="Cancelar"
        type={confirmDialog.type === 'confirmar' ? 'info' : 'warning'}
      />
    </div>
  )
}

export default OrdenesCompra
