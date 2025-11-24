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
import SearchBar from '../components/forms/SearchBar'
import OrdenCompraForm from '../components/forms/OrdenCompraForm'
import OrdenCompraDetalle from '../components/ordenes/OrdenCompraDetalle'
import Modal from '../components/ui/Modal'
import { Button, Badge, Loader, Card } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const OrdenesCompra = () => {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    estado: '',
    proveedor: '',
    fecha_inicio: '',
    fecha_fin: '',
  })
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false)
  const [selectedOrdenId, setSelectedOrdenId] = useState(null)

  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading, error } = useOrdenesCompra({
    search: debouncedSearch,
    ...filters,
    page,
  })

  const { data: ordenDetalle } = useOrdenCompra(selectedOrdenId)
  const { data: proveedoresData } = useProveedores()

  const createMutation = useCreateOrdenCompra()
  const confirmarMutation = useConfirmarOrdenCompra()
  const recibirMutation = useRecibirOrdenCompra()
  const cancelarMutation = useCancelarOrdenCompra()

  const ordenes = data?.results || []
  const totalPages = data?.count ? Math.ceil(data.count / 20) : 1
  const proveedores = proveedoresData?.results || []

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleOpenDetalle = (ordenId) => {
    setSelectedOrdenId(ordenId)
    setIsDetalleModalOpen(true)
  }

  const handleCloseDetalle = () => {
    setIsDetalleModalOpen(false)
    setSelectedOrdenId(null)
  }

  const handleSubmit = async (formData) => {
    try {
      await createMutation.mutateAsync(formData)
      handleCloseModal()
    } catch (error) {
      console.error('Error al crear orden:', error)
      alert('Error al crear la orden de compra')
    }
  }

  const handleConfirmar = async () => {
    if (window.confirm('¿Confirmar esta orden de compra?')) {
      try {
        await confirmarMutation.mutateAsync(selectedOrdenId)
        alert('Orden confirmada exitosamente')
      } catch (error) {
        console.error('Error al confirmar orden:', error)
        alert('Error al confirmar la orden')
      }
    }
  }

  const handleRecibir = async () => {
    if (window.confirm('¿Marcar esta orden como recibida? Esto actualizará el stock de los productos.')) {
      try {
        await recibirMutation.mutateAsync(selectedOrdenId)
        alert('Orden recibida y stock actualizado exitosamente')
      } catch (error) {
        console.error('Error al recibir orden:', error)
        alert('Error al recibir la orden')
      }
    }
  }

  const handleCancelar = async (motivo) => {
    try {
      await cancelarMutation.mutateAsync({ id: selectedOrdenId, motivo })
      alert('Orden cancelada exitosamente')
    } catch (error) {
      console.error('Error al cancelar orden:', error)
      alert('Error al cancelar la orden')
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-MX')
  }

  const getEstadoBadge = (estado) => {
    const variants = {
      pendiente: 'warning',
      completado: 'success',
      cancelado: 'danger',
    }
    return variants[estado] || 'default'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Órdenes de Compra</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Gestión de órdenes de compra a proveedores</p>
        </div>
        <Button onClick={handleOpenModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Orden
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por número de orden..."
            />
          </div>
          
          <div>
            <select
              value={filters.estado}
              onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <select
              value={filters.proveedor}
              onChange={(e) => setFilters({ ...filters, proveedor: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map(proveedor => (
                <option key={proveedor.id_proveedor} value={proveedor.id_proveedor}>
                  {proveedor.nombre_empresa}
                </option>
              ))}
            </select>
          </div>

          <Button variant="secondary" onClick={() => {
            setSearch('')
            setFilters({ estado: '', proveedor: '', fecha_inicio: '', fecha_fin: '' })
          }}>
            Limpiar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filters.fecha_inicio}
              onChange={(e) => setFilters({ ...filters, fecha_inicio: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filters.fecha_fin}
              onChange={(e) => setFilters({ ...filters, fecha_fin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </Card>

      {/* Orders List */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">Error al cargar órdenes: {error.message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : ordenes.length === 0 ? (
        <Card className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay órdenes</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {search || filters.estado || filters.proveedor
              ? 'No se encontraron órdenes con los filtros aplicados'
              : 'Comienza creando una nueva orden de compra'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-transparent dark:border-gray-700"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ordenes.map((orden) => (
                  <motion.tr
                    key={orden.id_orden}
                    variants={fadeIn}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {orden.id_orden}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {orden.proveedor_nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(orden.fecha_creacion)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getEstadoBadge(orden.estado_display.toLowerCase())}>
                        {orden.estado_display}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400 text-right">
                      {formatCurrency(orden.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleOpenDetalle(orden.id_orden)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 transition-colors"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <Button
                  variant="secondary"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Siguiente
                </Button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Página <span className="font-medium">{page}</span> de{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Modal de Nueva Orden */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Nueva Orden de Compra"
        size="xl"
      >
        <OrdenCompraForm
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isLoading={createMutation.isPending}
        />
      </Modal>

      {/* Modal de Detalle */}
      <Modal
        isOpen={isDetalleModalOpen}
        onClose={handleCloseDetalle}
        title="Detalle de Orden de Compra"
        size="xl"
      >
        {ordenDetalle && (
          <OrdenCompraDetalle
            orden={ordenDetalle}
            onConfirmar={handleConfirmar}
            onRecibir={handleRecibir}
            onCancelar={handleCancelar}
            isLoading={
              confirmarMutation.isPending || 
              recibirMutation.isPending || 
              cancelarMutation.isPending
            }
          />
        )}
      </Modal>
    </div>
  )
}

export default OrdenesCompra
