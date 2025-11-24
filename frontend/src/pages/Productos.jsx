import { useState } from 'react'
import { motion } from 'framer-motion'
import { useProductos, useCreateProducto, useUpdateProducto, useDeleteProducto, useProducto, useProductoMovimientos } from '../hooks/useProductos'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import SearchBar from '../components/forms/SearchBar'
import ProductoForm from '../components/forms/ProductoForm'
import ProductoDetalle from '../components/productos/ProductoDetalle'
import Modal from '../components/ui/Modal'
import { Button, Badge, Loader, Card, ConfirmDialog } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const Productos = () => {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    bajo_stock: '',
  })
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProducto, setSelectedProducto] = useState(null)
  const [selectedProductoId, setSelectedProductoId] = useState(null)
  const [productoToDelete, setProductoToDelete] = useState(null)

  const toast = useToast()
  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading, error } = useProductos({
    search: debouncedSearch,
    ...filters,
    page,
  })

  const createMutation = useCreateProducto()
  const updateMutation = useUpdateProducto()
  const deleteMutation = useDeleteProducto()

  const { data: productoDetalle } = useProducto(selectedProductoId)
  const { data: movimientos, isLoading: isLoadingMovimientos } = useProductoMovimientos(selectedProductoId)

  const productos = data?.results || []
  const totalPages = data?.count ? Math.ceil(data.count / 20) : 1

  const handleOpenModal = (producto = null) => {
    setSelectedProducto(producto)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProducto(null)
  }

  const handleOpenDetalle = (productoId) => {
    setSelectedProductoId(productoId)
    setIsDetalleModalOpen(true)
  }

  const handleCloseDetalle = () => {
    setIsDetalleModalOpen(false)
    setSelectedProductoId(null)
  }

  const handleSubmit = async (formData) => {
    try {
      if (selectedProducto) {
        await updateMutation.mutateAsync({ id: selectedProducto.id_producto, data: formData })
        toast.success('Producto actualizado exitosamente')
      } else {
        await createMutation.mutateAsync(formData)
        toast.success('Producto creado exitosamente')
      }
      handleCloseModal()
    } catch (error) {
      console.error('Error al guardar producto:', error)
      toast.error(error.response?.data?.message || 'Error al guardar el producto')
    }
  }

  const handleDeleteClick = (producto) => {
    setProductoToDelete(producto)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (productoToDelete) {
      try {
        await deleteMutation.mutateAsync(productoToDelete.id_producto)
        toast.success('Producto eliminado exitosamente')
        setProductoToDelete(null)
      } catch (error) {
        console.error('Error al eliminar producto:', error)
        toast.error(error.response?.data?.message || 'Error al eliminar el producto')
      }
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Gestión de inventario de productos</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Producto
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por código o nombre..."
            />
          </div>
          <Button variant="secondary" onClick={() => {
            setSearch('')
            setFilters({ bajo_stock: '' })
          }}>
            Limpiar Filtros
          </Button>
        </div>
      </Card>

      {/* Products List */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">Error al cargar productos: {error.message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : productos.length === 0 ? (
        <Card className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay productos</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {search
              ? 'No se encontraron productos con los filtros aplicados'
              : 'Comienza creando un nuevo producto'}
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
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Precio Venta
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {productos.map((producto) => (
                  <motion.tr
                    key={producto.id_producto}
                    variants={fadeIn}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {producto.sku_producto}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{producto.nombre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-sm font-medium ${
                          producto.cantidad_actual <= producto.cantidad_minima ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {producto.cantidad_actual}
                        </span>
                        {producto.cantidad_actual <= producto.cantidad_minima && (
                          <svg
                            className="ml-2 h-5 w-5 text-red-500 dark:text-red-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Mín: {producto.cantidad_minima}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(producto.precio_final)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleOpenDetalle(producto.id_producto)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 mr-3 transition-colors"
                      >
                        Ver
                      </button>
                      <button 
                        onClick={() => handleOpenModal(producto)}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mr-3 transition-colors"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(producto)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                        disabled={deleteMutation.isPending}
                      >
                        Eliminar
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

      {/* Modal de Producto */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedProducto ? 'Editar Producto' : 'Nuevo Producto'}
        size="lg"
      >
        <ProductoForm
          producto={selectedProducto}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      {/* Modal de Detalle */}
      <Modal
        isOpen={isDetalleModalOpen}
        onClose={handleCloseDetalle}
        title="Detalle del Producto"
        size="xl"
      >
        {productoDetalle && (
          <ProductoDetalle
            producto={productoDetalle}
            movimientos={movimientos || []}
            isLoadingMovimientos={isLoadingMovimientos}
          />
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar Producto"
        message={`¿Estás seguro de que deseas eliminar el producto "${productoToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default Productos
