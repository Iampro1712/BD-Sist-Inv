import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  useOrdenesVenta,
  useOrdenVenta,
  useCreateOrdenVenta,
} from '../hooks/useOrdenesVenta'
import { useClientes } from '../hooks/useClientes'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import SearchBar from '../components/forms/SearchBar'
import OrdenVentaForm from '../components/forms/OrdenVentaForm'
import OrdenVentaDetalle from '../components/ordenes/OrdenVentaDetalle'
import Modal from '../components/ui/Modal'
import { Button, Card } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const OrdenesVenta = () => {
  const [search, setSearch]               = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [fechaInicio, setFechaInicio]     = useState('')
  const [fechaFin, setFechaFin]           = useState('')
  const [page, setPage]                   = useState(1)
  const [isModalOpen, setIsModalOpen]     = useState(false)
  const [isDetalleOpen, setIsDetalleOpen] = useState(false)
  const [selectedOrdenId, setSelectedOrdenId] = useState(null)

  const debouncedSearch = useDebounce(search, 500)
  const toast = useToast()

  const { data, isLoading, error } = useOrdenesVenta({
    search: debouncedSearch,
    cliente: clienteFiltro || undefined,
    fecha_inicio: fechaInicio || undefined,
    fecha_fin: fechaFin || undefined,
    page,
  })

  const { data: ordenDetalle } = useOrdenVenta(selectedOrdenId)
  const { data: clientesData }  = useClientes()
  const createMutation = useCreateOrdenVenta()

  const ordenes    = data?.results || []
  const totalCount = data?.count   || 0
  const totalPages = totalCount ? Math.ceil(totalCount / 20) : 1
  const clientes   = clientesData?.results || []
  const hayFiltros = search || clienteFiltro || fechaInicio || fechaFin

  const limpiarFiltros = () => {
    setSearch(''); setClienteFiltro('')
    setFechaInicio(''); setFechaFin(''); setPage(1)
  }

  const handleOpenDetalle = (id) => { setSelectedOrdenId(id); setIsDetalleOpen(true) }
  const handleCloseDetalle = () => { setIsDetalleOpen(false); setSelectedOrdenId(null) }

  const handleSubmit = async (formData) => {
    try {
      await createMutation.mutateAsync(formData)
      setIsModalOpen(false)
      toast.success('Venta creada exitosamente')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al crear la venta'
      toast.error(msg)
    }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ventas</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Gestión de ventas a clientes</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shrink-0">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Venta
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="Buscar por número de venta..."
            />
          </div>
          <select
            value={clienteFiltro}
            onChange={(e) => { setClienteFiltro(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Todos los clientes</option>
            {clientes.map(c => (
              <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
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
          Error al cargar ventas: {error.message}
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
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : ordenes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {hayFiltros ? 'Sin resultados' : 'No hay ventas'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {hayFiltros
              ? 'Intenta cambiar los filtros de búsqueda'
              : 'Crea tu primera venta para empezar'}
          </p>
          {!hayFiltros && (
            <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
              Nueva Venta
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28"># Venta</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Fecha</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ordenes.map((orden) => (
                  <motion.tr
                    key={orden.id_venta}
                    variants={fadeIn}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        #{orden.id_venta}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                            {(orden.cliente_nombre || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-base font-medium text-gray-900 dark:text-white">
                          {orden.cliente_nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-base text-gray-500 dark:text-gray-400">
                      {formatDate(orden.fecha)}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        {formatCurrency(orden.total)}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleOpenDetalle(orden.id_venta)}
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
                ))}
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

      {/* Modal Nueva Venta */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nueva Venta" size="xl">
        <OrdenVentaForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={createMutation.isPending}
        />
      </Modal>

      {/* Modal Detalle */}
      <Modal isOpen={isDetalleOpen} onClose={handleCloseDetalle} title="Detalle de Venta" size="xl">
        {ordenDetalle && (
          <OrdenVentaDetalle orden={ordenDetalle} />
        )}
      </Modal>

    </div>
  )
}

export default OrdenesVenta
