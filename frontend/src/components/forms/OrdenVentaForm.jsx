import { useState, useEffect } from 'react'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { Button, Input } from '../ui'

const OrdenVentaForm = ({ orden = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    descuento: 0,
    notas: '',
    detalles: [],
  })

  const [errors, setErrors] = useState({})
  const [selectedProducto, setSelectedProducto] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [stockWarnings, setStockWarnings] = useState({})

  const { data: clientesData } = useClientes()
  const { data: productosData } = useProductos({ activo: 'true' })

  const clientes = clientesData?.results || []
  const productos = productosData?.results || []

  useEffect(() => {
    if (orden) {
      setFormData({
        cliente: orden.cliente || '',
        fecha: orden.fecha || new Date().toISOString().split('T')[0],
        descuento: orden.descuento || 0,
        notas: orden.notas || '',
        detalles: orden.detalles || [],
      })
    }
  }, [orden])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleDescuentoChange = (e) => {
    const value = parseFloat(e.target.value) || 0
    setFormData(prev => ({ ...prev, descuento: value }))
    if (errors.descuento) {
      setErrors(prev => ({ ...prev, descuento: '' }))
    }
  }

  const checkStockAvailability = (productoId, cantidadSolicitada) => {
    const producto = productos.find(p => p.id_producto === parseInt(productoId))
    if (!producto) return { available: false, message: 'Producto no encontrado' }

    // Calculate total quantity already in cart for this product
    const cantidadEnCarrito = formData.detalles
      .filter(d => d.producto === parseInt(productoId))
      .reduce((sum, d) => sum + d.cantidad, 0)

    const cantidadTotal = cantidadEnCarrito + cantidadSolicitada
    const stockDisponible = producto.cantidad_actual

    if (cantidadTotal > stockDisponible) {
      return {
        available: false,
        message: `Stock insuficiente. Disponible: ${stockDisponible}, En carrito: ${cantidadEnCarrito}, Solicitado: ${cantidadSolicitada}`
      }
    }

    if (cantidadTotal === stockDisponible) {
      return {
        available: true,
        warning: `Advertencia: Esto agotará el stock disponible (${stockDisponible} unidades)`
      }
    }

    return { available: true }
  }

  const handleAddProducto = () => {
    if (!selectedProducto) {
      setErrors(prev => ({ ...prev, producto: 'Selecciona un producto' }))
      return
    }
    if (!cantidad || parseInt(cantidad) <= 0) {
      setErrors(prev => ({ ...prev, cantidad: 'La cantidad debe ser mayor a 0' }))
      return
    }
    if (!precioUnitario || parseFloat(precioUnitario) <= 0) {
      setErrors(prev => ({ ...prev, precioUnitario: 'El precio debe ser mayor a 0' }))
      return
    }

    // Check stock availability
    const stockCheck = checkStockAvailability(selectedProducto, parseInt(cantidad))
    if (!stockCheck.available) {
      setErrors(prev => ({ ...prev, stock: stockCheck.message }))
      return
    }

    const producto = productos.find(p => p.id_producto === parseInt(selectedProducto))
    if (!producto) return

    const detalle = {
      producto: producto.id_producto,
      producto_nombre: producto.nombre,
      producto_codigo: producto.sku_producto,
      cantidad: parseInt(cantidad),
      precio_unitario: parseFloat(precioUnitario),
      subtotal: parseInt(cantidad) * parseFloat(precioUnitario),
      stock_disponible: producto.cantidad_actual,
    }

    setFormData(prev => ({
      ...prev,
      detalles: [...prev.detalles, detalle],
    }))

    // Show warning if exists
    if (stockCheck.warning) {
      setStockWarnings(prev => ({
        ...prev,
        [producto.id]: stockCheck.warning
      }))
    }

    setSelectedProducto('')
    setCantidad('')
    setPrecioUnitario('')
    setErrors({})
  }

  const handleRemoveProducto = (index) => {
    const detalle = formData.detalles[index]
    setFormData(prev => ({
      ...prev,
      detalles: prev.detalles.filter((_, i) => i !== index),
    }))
    
    // Remove warning if no more items of this product
    const hasMoreOfSameProduct = formData.detalles.some(
      (d, i) => i !== index && d.producto === detalle.producto
    )
    if (!hasMoreOfSameProduct) {
      setStockWarnings(prev => {
        const newWarnings = { ...prev }
        delete newWarnings[detalle.producto]
        return newWarnings
      })
    }
  }

  const calcularSubtotal = () => {
    return formData.detalles.reduce((sum, detalle) => sum + detalle.subtotal, 0)
  }

  const calcularTotal = () => {
    const subtotal = calcularSubtotal()
    return subtotal - formData.descuento
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.cliente) newErrors.cliente = 'El cliente es requerido'
    if (!formData.fecha) newErrors.fecha = 'La fecha es requerida'
    if (formData.detalles.length === 0) {
      newErrors.detalles = 'Debes agregar al menos un producto'
    }
    if (formData.descuento < 0) {
      newErrors.descuento = 'El descuento no puede ser negativo'
    }
    if (formData.descuento > calcularSubtotal()) {
      newErrors.descuento = 'El descuento no puede ser mayor al subtotal'
    }

    // Validate stock for all items
    for (const detalle of formData.detalles) {
      const producto = productos.find(p => p.id_producto === detalle.producto)
      if (producto) {
        const cantidadTotal = formData.detalles
          .filter(d => d.producto === detalle.producto)
          .reduce((sum, d) => sum + d.cantidad, 0)
        
        if (cantidadTotal > producto.cantidad_actual) {
          newErrors.stock = `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.cantidad_actual}`
          break
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const clienteId = parseInt(formData.cliente)
      if (isNaN(clienteId)) {
        setErrors(prev => ({ ...prev, cliente: 'Debe seleccionar un cliente' }))
        return
      }
      
      const submitData = {
        cliente: clienteId,
        fecha: formData.fecha,
        total: calcularTotal(),
        detalles: formData.detalles,
      }
      onSubmit(submitData)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cliente *
          </label>
          <select
            name="cliente"
            value={formData.cliente}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              errors.cliente ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Seleccionar cliente...</option>
            {clientes.map(cliente => (
              <option key={cliente.id_cliente} value={cliente.id_cliente}>
                {cliente.nombre}
              </option>
            ))}
          </select>
          {errors.cliente && (
            <p className="mt-1 text-sm text-red-600">{errors.cliente}</p>
          )}
        </div>

        <Input
          label="Fecha *"
          name="fecha"
          type="date"
          value={formData.fecha}
          onChange={handleChange}
          error={errors.fecha}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas
        </label>
        <textarea
          name="notas"
          value={formData.notas}
          onChange={handleChange}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Notas adicionales..."
        />
      </div>

      {/* Agregar Productos */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Productos</h3>
        
        {errors.stock && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {errors.stock}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
          <div className="md:col-span-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Producto
            </label>
            <select
              value={selectedProducto}
              onChange={(e) => {
                setSelectedProducto(e.target.value)
                const producto = productos.find(p => p.id_producto === parseInt(e.target.value))
                if (producto) {
                  setPrecioUnitario(producto.precio_final || '')
                }
                if (errors.producto) {
                  setErrors(prev => ({ ...prev, producto: '' }))
                }
                if (errors.stock) {
                  setErrors(prev => ({ ...prev, stock: '' }))
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.producto ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Seleccionar producto...</option>
              {productos.map(producto => (
                <option key={producto.id_producto} value={producto.id_producto}>
                  {producto.sku_producto} - {producto.nombre} (Stock: {producto.cantidad_actual})
                </option>
              ))}
            </select>
            {errors.producto && (
              <p className="mt-1 text-sm text-red-600">{errors.producto}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => {
                setCantidad(e.target.value)
                if (errors.cantidad) {
                  setErrors(prev => ({ ...prev, cantidad: '' }))
                }
                if (errors.stock) {
                  setErrors(prev => ({ ...prev, stock: '' }))
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.cantidad ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0"
            />
            {errors.cantidad && (
              <p className="mt-1 text-sm text-red-600">{errors.cantidad}</p>
            )}
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Precio Unitario
            </label>
            <input
              type="number"
              step="0.01"
              value={precioUnitario}
              onChange={(e) => {
                setPrecioUnitario(e.target.value)
                if (errors.precioUnitario) {
                  setErrors(prev => ({ ...prev, precioUnitario: '' }))
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.precioUnitario ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
            {errors.precioUnitario && (
              <p className="mt-1 text-sm text-red-600">{errors.precioUnitario}</p>
            )}
          </div>

          <div className="md:col-span-2 flex items-end">
            <Button
              type="button"
              onClick={handleAddProducto}
              className="w-full"
            >
              Agregar
            </Button>
          </div>
        </div>

        {errors.detalles && (
          <p className="mb-4 text-sm text-red-600">{errors.detalles}</p>
        )}

        {/* Stock Warnings */}
        {Object.keys(stockWarnings).length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            {Object.values(stockWarnings).map((warning, index) => (
              <p key={index} className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {warning}
              </p>
            ))}
          </div>
        )}

        {/* Tabla de Productos */}
        {formData.detalles.length > 0 && (
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
                    Stock Disp.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Precio Unit.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Subtotal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {formData.detalles.map((detalle, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                      {detalle.producto_codigo}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {detalle.producto_nombre}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300 text-right">
                      {detalle.cantidad}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {detalle.stock_disponible}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300 text-right">
                      {formatCurrency(detalle.precio_unitario)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                      {formatCurrency(detalle.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveProducto(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Descuento y Totales */}
      {formData.detalles.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="max-w-md ml-auto space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-600 dark:text-gray-400">Subtotal:</span>
              <span className="text-base font-medium text-gray-900 dark:text-white">
                {formatCurrency(calcularSubtotal())}
              </span>
            </div>

            <div className="flex justify-between items-center gap-4">
              <label className="text-base text-gray-600 dark:text-gray-400">Descuento:</label>
              <div className="flex-1 max-w-xs">
                <input
                  type="number"
                  step="0.01"
                  value={formData.descuento}
                  onChange={handleDescuentoChange}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right ${
                    errors.descuento ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="0.00"
                />
                {errors.descuento && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.descuento}</p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(calcularTotal())}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={isLoading}
          disabled={isLoading}
        >
          {orden ? 'Actualizar' : 'Crear'} Orden
        </Button>
      </div>
    </form>
  )
}

export default OrdenVentaForm
