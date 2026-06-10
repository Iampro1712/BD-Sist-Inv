import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProductos, useCreateProducto, useUpdateProducto, useDeleteProducto, useProducto, useProductosStockBajo } from '../hooks/useProductos'
import { useProveedores } from '../hooks/useProveedores'
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
  const [filters, setFilters] = useState({ bajo_stock: '', proveedor: '', ordering: '' })
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProducto, setSelectedProducto] = useState(null)
  const [selectedProductoId, setSelectedProductoId] = useState(null)
  const [productoToDelete, setProductoToDelete] = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()
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
  const { data: stockBajoData } = useProductosStockBajo()
  const { data: proveedoresData } = useProveedores({ page_size: 200 })
  const proveedores = proveedoresData?.results || proveedoresData || []

  const productos = data?.results || []
  const totalCount = data?.count || 0
  const totalPages = totalCount ? Math.ceil(totalCount / 20) : 1
  const lowStockCount = Array.isArray(stockBajoData) ? stockBajoData.length : 0

  useEffect(() => {
    const productoId = searchParams.get('id')
    if (productoId && !isDetalleModalOpen) {
      setSelectedProductoId(parseInt(productoId))
      setIsDetalleModalOpen(true)
      setSearchParams({})
    }
  }, [searchParams, isDetalleModalOpen, setSearchParams])

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
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(value || 0)
  }

  const getStockStatus = (producto) => {
    const ratio = producto.cantidad_minima > 0
      ? producto.cantidad_actual / producto.cantidad_minima
      : producto.cantidad_actual > 0 ? 2 : 0
    if (ratio <= 0) return { label: 'Sin stock', color: 'danger', barColor: 'bg-red-500', barWidth: '0%' }
    if (ratio <= 1) return { label: 'Stock bajo', color: 'danger', barColor: 'bg-red-500', barWidth: `${Math.min(ratio * 50, 50)}%` }
    if (ratio <= 1.5) return { label: 'Stock justo', color: 'warning', barColor: 'bg-yellow-400', barWidth: `${Math.min(ratio * 40, 70)}%` }
    return { label: 'Stock OK', color: 'success', barColor: 'bg-green-500', barWidth: '100%' }
  }

  const toggleBajoStock = () => {
    setPage(1)
    setFilters(prev => ({ ...prev, bajo_stock: prev.bajo_stock === 'true' ? '' : 'true' }))
  }

  const handleFilterChange = (key, value) => {
    setPage(1)
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearAllFilters = () => {
    setPage(1)
    setSearch('')
    setFilters({ bajo_stock: '', proveedor: '', ordering: '' })
  }

  const activeFiltersCount = [
    filters.bajo_stock === 'true',
    filters.proveedor !== '',
    filters.ordering !== '',
    search !== '',
  ].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Gestión y control de inventario
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="shrink-0">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Producto
        </Button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
            {isLoading ? (
              <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Stock bajo</p>
            {isLoading ? (
              <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
            ) : (
              <p className={`text-xl font-bold ${lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {lowStockCount}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Búsqueda y filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          {/* Fila 1: búsqueda */}
          <SearchBar
            value={search}
            onChange={(val) => { setSearch(val); setPage(1) }}
            placeholder="Buscar por código SKU o nombre del producto..."
          />

          {/* Fila 2: filtros */}
          <div className="flex flex-wrap gap-2">
            {/* Filtro proveedor */}
            <select
              value={filters.proveedor}
              onChange={(e) => handleFilterChange('proveedor', e.target.value)}
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre_empresa}
                </option>
              ))}
            </select>

            {/* Ordenar por */}
            <select
              value={filters.ordering}
              onChange={(e) => handleFilterChange('ordering', e.target.value)}
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              <option value="">Ordenar por defecto</option>
              <option value="nombre">Nombre A→Z</option>
              <option value="-nombre">Nombre Z→A</option>
              <option value="precio_final">Precio menor→mayor</option>
              <option value="-precio_final">Precio mayor→menor</option>
              <option value="cantidad_actual">Stock menor→mayor</option>
              <option value="-cantidad_actual">Stock mayor→menor</option>
            </select>

            {/* Toggle stock bajo */}
            <button
              onClick={toggleBajoStock}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${
                filters.bajo_stock === 'true'
                  ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Stock bajo
              {filters.bajo_stock === 'true' && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Limpiar filtros */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Limpiar ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {activeFiltersCount > 0 && !isLoading && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {totalCount} resultado{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
            {filters.bajo_stock === 'true' && ' · Stock bajo'}
            {filters.proveedor && ' · Proveedor filtrado'}
          </p>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-800 dark:text-red-400 text-sm">Error al cargar productos: {error.message}</p>
        </div>
      )}

      {/* Lista de productos */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : productos.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {search || filters.bajo_stock ? 'Sin resultados' : 'No hay productos'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {search || filters.bajo_stock === 'true'
              ? 'Intenta cambiar los filtros de búsqueda'
              : 'Comienza agregando tu primer producto al inventario'}
          </p>
          {!search && filters.bajo_stock !== 'true' && (
            <Button className="mt-4" onClick={() => handleOpenModal()}>
              Agregar producto
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                    Precio Venta
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {productos.map((producto) => {
                  const stockStatus = getStockStatus(producto)
                  return (
                    <motion.tr
                      key={producto.id_producto}
                      variants={fadeIn}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {producto.sku_producto}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{producto.nombre}</p>
                        {producto.proveedor_nombre && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{producto.proveedor_nombre}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${
                            stockStatus.color === 'danger' ? 'text-red-600 dark:text-red-400' :
                            stockStatus.color === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-gray-900 dark:text-white'
                          }`}>
                            {producto.cantidad_actual}
                          </span>
                          <Badge variant={stockStatus.color} className="text-xs">
                            {stockStatus.label}
                          </Badge>
                        </div>
                        <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                          <div
                            className={`h-1 rounded-full transition-all ${stockStatus.barColor}`}
                            style={{ width: stockStatus.barWidth }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">mín. {producto.cantidad_minima}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(producto.precio_final)}
                        </p>
                        {producto.precio_compra_unitario && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            compra: {formatCurrency(producto.precio_compra_unitario)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDetalle(producto.id_producto)}
                            title="Ver detalle"
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenModal(producto)}
                            title="Editar"
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(producto)}
                            title="Eliminar"
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
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
              <div className="flex items-center gap-2">
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
            onEdit={() => {
              handleCloseDetalle()
              handleOpenModal(productoDetalle)
            }}
          />
        )}
      </Modal>

      {/* Confirmar eliminación */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar Producto"
        message={`¿Estás seguro de que deseas eliminar "${productoToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default Productos
