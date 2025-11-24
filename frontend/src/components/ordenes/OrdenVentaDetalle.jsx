import { Badge, Button } from '../ui'

const OrdenVentaDetalle = ({ 
  orden, 
  onConfirmar, 
  onCancelar,
  isLoading = false 
}) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getEstadoBadge = (estado) => {
    const variants = {
      pendiente: 'warning',
      confirmada: 'success',
      entregada: 'info',
      cancelada: 'danger',
    }
    return variants[estado] || 'default'
  }

  const getEstadoLabel = (estado) => {
    const labels = {
      pendiente: 'Pendiente',
      confirmada: 'Confirmada',
      entregada: 'Entregada',
      cancelada: 'Cancelada',
    }
    return labels[estado] || estado
  }

  const handleCancelar = () => {
    const motivo = prompt('Ingresa el motivo de cancelación:')
    if (motivo) {
      onCancelar(motivo)
    }
  }

  return (
    <div className="space-y-6">
      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Información de la Venta</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Número de Venta:</span>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{orden.id_venta}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Fecha:</span>
              <p className="text-base text-gray-900 dark:text-gray-300">{formatDate(orden.fecha)}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Cliente</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Nombre:</span>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{orden.cliente_nombre}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Productos */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Productos</h3>
        {orden.productos && orden.productos.length > 0 ? (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Precio Unitario
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {orden.productos.map((producto, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {producto.sku}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {producto.nombre}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300 text-right">
                      {producto.cantidad}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300 text-right">
                      {formatCurrency(producto.precio_unitario)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                      {formatCurrency(producto.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            No hay productos en esta venta
          </div>
        )}
      </div>

      {/* Totales */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
          <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(orden.total)}
          </span>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {orden.estado === 'pendiente' && (
          <>
            <Button
              variant="danger"
              onClick={handleCancelar}
              disabled={isLoading}
            >
              Cancelar Orden
            </Button>
            <Button
              onClick={onConfirmar}
              loading={isLoading}
              disabled={isLoading}
            >
              Confirmar Orden
            </Button>
          </>
        )}
        
        {orden.estado === 'confirmada' && (
          <>
            <Button
              variant="danger"
              onClick={handleCancelar}
              disabled={isLoading}
            >
              Cancelar Orden
            </Button>
            <div className="text-sm text-green-600 font-medium flex items-center">
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Orden confirmada y stock actualizado
            </div>
          </>
        )}

        {orden.estado === 'entregada' && (
          <div className="text-sm text-blue-600 font-medium flex items-center">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
            </svg>
            Orden entregada
          </div>
        )}

        {orden.estado === 'cancelada' && (
          <div className="text-sm text-red-600 font-medium flex items-center">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Orden cancelada
          </div>
        )}
      </div>
    </div>
  )
}

export default OrdenVentaDetalle
