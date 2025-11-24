import { Badge, Button } from '../ui'

const OrdenCompraDetalle = ({ 
  orden, 
  onConfirmar, 
  onRecibir, 
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
      completado: 'success',
      cancelado: 'danger',
    }
    return variants[estado] || 'default'
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
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Información de la Orden</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Número de Orden:</span>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{orden.id_orden}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Fecha:</span>
              <p className="text-base text-gray-900 dark:text-gray-300">{formatDate(orden.fecha_creacion)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Estado:</span>
              <div className="mt-1">
                <Badge variant={getEstadoBadge(orden.estado_display?.toLowerCase())}>
                  {orden.estado_display}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Proveedor</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Nombre:</span>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{orden.proveedor_nombre}</p>
            </div>
            {orden.proveedor_contacto && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Contacto:</span>
                <p className="text-base text-gray-900 dark:text-gray-300">{orden.proveedor_contacto}</p>
              </div>
            )}
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
                    Precio Unitario
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {orden.productos.map((producto) => (
                  <tr key={producto.id_producto}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {producto.sku}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {producto.nombre}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300 text-right">
                      {formatCurrency(producto.precio_compra)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                      {formatCurrency(producto.precio_compra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            No hay productos en esta orden
          </div>
        )}
      </div>

      {/* Total */}
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
            <Button
              onClick={onRecibir}
              loading={isLoading}
              disabled={isLoading}
            >
              Marcar como Recibida
            </Button>
          </>
        )}

        {orden.estado === 'recibida' && (
          <div className="text-sm text-green-600 dark:text-green-400 font-medium">
            ✓ Orden recibida y stock actualizado
          </div>
        )}

        {orden.estado === 'cancelada' && (
          <div className="text-sm text-red-600 dark:text-red-400 font-medium">
            ✗ Orden cancelada
          </div>
        )}
      </div>
    </div>
  )
}

export default OrdenCompraDetalle
