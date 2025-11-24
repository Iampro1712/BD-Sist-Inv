import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMovimientos, useCrearAjuste } from '../hooks/useMovimientos'
import { useProductos } from '../hooks/useProductos'
import { useDebounce } from '../hooks/useDebounce'
import SearchBar from '../components/forms/SearchBar'
import Modal from '../components/ui/Modal'
import { Button, Badge, Loader, Card } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const Movimientos = () => {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    producto: '',
    tipo: '',
    fecha_inicio: '',
    fecha_fin: '',
  })
  const [page, setPage] = useState(1)
  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false)
  const [ajusteForm, setAjusteForm] = useState({
    producto_id: '',
    cantidad: '',
    notas: '',
  })

  const debouncedSearch = useDebounce(search, 500)

  const { data, isLoading, error } = useMovimientos({
    search: debouncedSearch,
    ...filters,
    page,
  })

  const { data: productosData } = useProductos()
  const crearAjusteMutation = useCrearAjuste()

  const movimientos = data?.results || []
  const totalPages = data?.count ? Math.ceil(data.count / 20) : 1
  const productos = productosData?.results || []

  const handleOpenAjusteModal = () => {
    setAjusteForm({ producto_id: '', cantidad: '', notas: '' })
    setIsAjusteModalOpen(true)
  }

  const handleCloseAjusteModal = () => {
    setIsAjusteModalOpen(false)
    setAjusteForm({ producto_id: '', cantidad: '', notas: '' })
  }

  const handleAjusteSubmit = async (e) => {
    e.preventDefault()

    // Validaciones
    if (!ajusteForm.producto_id) {
      alert('Debe seleccionar un producto')
      return
    }

    if (!ajusteForm.cantidad || ajusteForm.cantidad === '0') {
      alert('Debe ingresar una cantidad válida')
      return
    }

    // Validar que el ajuste no deje stock negativo
    const producto = productos.find(p => p.id === parseInt(ajusteForm.producto_id))
    if (producto) {
      const nuevaCantidad = parseInt(ajusteForm.cantidad)
      const nuevoStock = producto.stock_actual + nuevaCantidad
      
      if (nuevoStock < 0) {
        alert(`El ajuste dejaría el stock en ${nuevoStock}. No se puede tener stock negativo.`)
        return
      }
    }

    if (window.confirm(`¿Confirmar ajuste de inventario?\n\nProducto: ${producto?.nombre}\nCantidad: ${ajusteForm.cantidad}\n\nEsto modificará el stock del producto.`)) {
      try {
        await crearAjusteMutation.mutateAsync(ajusteForm)
        alert('Ajuste de inventario realizado exitosamente')
        handleCloseAjusteModal()
      } catch (error) {
        console.error('Error al crear ajuste:', error)
        alert(error.response?.data?.error || 'Error al crear el ajuste de inventario')
      }
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTipoBadge = (tipo) => {
    const variants = {
      entrada: 'success',
      salida: 'danger',
      ajuste: 'warning',
    }
    return variants[tipo] || 'default'
  }

  const getTipoLabel = (tipo) => {
    const labels = {
      entrada: 'Entrada',
      salida: 'Salida',
      ajuste: 'Ajuste',
    }
    return labels[tipo] || tipo
  }

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'entrada':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0 0l-4-4m4 4l4-4" />
          </svg>
        )
      case 'salida':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 0l4 4m-4-4l-4 4" />
          </svg>
        )
      case 'ajuste':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Movimientos de Inventario</h1>
          <p className="mt-2 text-gray-600">Historial completo de movimientos de stock</p>
        </div>
        <Button onClick={handleOpenAjusteModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Ajuste Manual
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por producto o referencia..."
            />
          </div>
          
          <div>
            <select
              value={filters.producto}
              onChange={(e) => setFilters({ ...filters, producto: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Todos los productos</option>
              {productos.map(producto => (
                <option key={producto.id} value={producto.id}>
                  {producto.codigo} - {producto.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filters.tipo}
              onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Todos los tipos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>

          <Button variant="secondary" onClick={() => {
            setSearch('')
            setFilters({ producto: '', tipo: '', fecha_inicio: '', fecha_fin: '' })
          }}>
            Limpiar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filters.fecha_inicio}
              onChange={(e) => setFilters({ ...filters, fecha_inicio: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filters.fecha_fin}
              onChange={(e) => setFilters({ ...filters, fecha_fin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </Card>

      {/* Movements List */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error al cargar movimientos: {error.message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : movimientos.length === 0 ? (
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay movimientos</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search || filters.producto || filters.tipo
              ? 'No se encontraron movimientos con los filtros aplicados'
              : 'No hay movimientos de inventario registrados'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-xl shadow-md overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movimientos.map((movimiento) => (
                  <motion.tr
                    key={movimiento.id}
                    variants={fadeIn}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getTipoIcon(movimiento.tipo)}
                        <Badge variant={getTipoBadge(movimiento.tipo)}>
                          {getTipoLabel(movimiento.tipo)}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {movimiento.producto_codigo}
                      </div>
                      <div className="text-sm text-gray-500">
                        {movimiento.producto_nombre}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${
                        movimiento.tipo === 'entrada' 
                          ? 'text-green-600' 
                          : movimiento.tipo === 'salida'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`}>
                        {movimiento.tipo === 'entrada' ? '+' : movimiento.tipo === 'salida' ? '-' : '±'}
                        {Math.abs(movimiento.cantidad)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(movimiento.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {movimiento.referencia || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="max-w-xs truncate" title={movimiento.notas}>
                        {movimiento.notas || '-'}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
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
                  <p className="text-sm text-gray-700">
                    Página <span className="font-medium">{page}</span> de{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Modal de Ajuste Manual */}
      <Modal
        isOpen={isAjusteModalOpen}
        onClose={handleCloseAjusteModal}
        title="Ajuste Manual de Inventario"
        size="md"
      >
        <form onSubmit={handleAjusteSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto <span className="text-red-500">*</span>
            </label>
            <select
              value={ajusteForm.producto_id}
              onChange={(e) => setAjusteForm({ ...ajusteForm, producto_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar producto</option>
              {productos.map(producto => (
                <option key={producto.id} value={producto.id}>
                  {producto.codigo} - {producto.nombre} (Stock actual: {producto.stock_actual})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={ajusteForm.cantidad}
              onChange={(e) => setAjusteForm({ ...ajusteForm, cantidad: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ingrese cantidad (positivo para aumentar, negativo para disminuir)"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Use números positivos para aumentar stock o negativos para disminuir
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={ajusteForm.notas}
              onChange={(e) => setAjusteForm({ ...ajusteForm, notas: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows="3"
              placeholder="Motivo del ajuste (opcional)"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseAjusteModal}
              disabled={crearAjusteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={crearAjusteMutation.isPending}
              disabled={crearAjusteMutation.isPending}
            >
              Confirmar Ajuste
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Movimientos
