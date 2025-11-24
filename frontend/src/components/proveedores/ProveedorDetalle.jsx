import { motion } from 'framer-motion'
import { Badge, Loader } from '../ui'
import { fadeIn } from '../../utils/animations'
import { useNavigate } from 'react-router-dom'

const ProveedorDetalle = ({ 
  proveedor, 
  productos = [], 
  ordenes = [],
  isLoadingProductos = false,
  isLoadingOrdenes = false 
}) => {
  const navigate = useNavigate()

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getEstadoBadgeVariant = (estado) => {
    const variants = {
      'pendiente': 'warning',
      'confirmada': 'info',
      'recibida': 'success',
      'cancelada': 'default',
    }
    return variants[estado] || 'default'
  }

  return (
    <div className="space-y-6">
      {/* Información del Proveedor */}
      <motion.div variants={fadeIn} className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Proveedor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Nombre de la Empresa</p>
            <p className="text-base font-medium text-gray-900">{proveedor.nombre_empresa}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Persona de Contacto</p>
            <p className="text-base font-medium text-gray-900">{proveedor.persona_contacto || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Teléfono</p>
            <p className="text-base font-medium text-gray-900">{proveedor.telefono || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="text-base font-medium text-gray-900">{proveedor.email || '-'}</p>
          </div>
          {proveedor.direccion && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">Dirección</p>
              <p className="text-base font-medium text-gray-900">{proveedor.direccion}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Productos Asociados */}
      <motion.div variants={fadeIn}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Productos Asociados ({productos.length})
          </h3>
        </div>
        
        {isLoadingProductos ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : productos.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No hay productos asociados a este proveedor</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio Compra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productos.map((producto) => (
                    <tr key={producto.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {producto.codigo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{producto.nombre}</div>
                        <div className="text-sm text-gray-500">{producto.categoria_nombre}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {producto.stock_actual}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(producto.precio_compra)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={producto.activo ? 'success' : 'default'}>
                          {producto.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* Historial de Órdenes de Compra */}
      <motion.div variants={fadeIn}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Historial de Órdenes de Compra ({ordenes.length})
          </h3>
        </div>
        
        {isLoadingOrdenes ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
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
            <p className="mt-2 text-sm text-gray-500">No hay órdenes de compra registradas</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Número de Orden
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ordenes.map((orden) => (
                    <tr key={orden.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {orden.numero_orden}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(orden.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(orden.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getEstadoBadgeVariant(orden.estado)}>
                          {orden.estado}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => navigate(`/ordenes-compra/${orden.id}`)}
                          className="text-primary-600 hover:text-primary-900 transition-colors"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default ProveedorDetalle
