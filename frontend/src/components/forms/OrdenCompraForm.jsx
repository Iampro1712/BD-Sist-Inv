import { useState, useEffect } from 'react'
import { useProveedores } from '../../hooks/useProveedores'
import { useProductos } from '../../hooks/useProductos'
import { Button, Input } from '../ui'

const OrdenCompraForm = ({ orden = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    notas: '',
    detalles: [],
  })

  const [errors, setErrors] = useState({})
  const [selectedProducto, setSelectedProducto] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')

  const { data: proveedoresData } = useProveedores()
  const { data: productosData } = useProductos({ activo: 'true' })

  const proveedores = proveedoresData?.results || []
  const productos = productosData?.results || []

  useEffect(() => {
    if (orden) {
      setFormData({
        proveedor: orden.proveedor || '',
        fecha: orden.fecha || new Date().toISOString().split('T')[0],
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

    const producto = productos.find(p => p.id_producto === parseInt(selectedProducto))
    if (!producto) return

    const detalle = {
      producto: producto.id_producto,
      producto_nombre: producto.nombre,
      producto_codigo: producto.sku_producto,
      cantidad: parseInt(cantidad),
      precio_unitario: parseFloat(precioUnitario),
      subtotal: parseInt(cantidad) * parseFloat(precioUnitario),
    }

    setFormData(prev => ({
      ...prev,
      detalles: [...prev.detalles, detalle],
    }))

    setSelectedProducto('')
    setCantidad('')
    setPrecioUnitario('')
    setErrors({})
  }

  const handleRemoveProducto = (index) => {
    setFormData(prev => ({
      ...prev,
      detalles: prev.detalles.filter((_, i) => i !== index),
    }))
  }

  const calcularTotal = () => {
    return formData.detalles.reduce((sum, detalle) => sum + detalle.subtotal, 0)
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.proveedor) newErrors.proveedor = 'El proveedor es requerido'
    if (!formData.fecha) newErrors.fecha = 'La fecha es requerida'
    if (formData.detalles.length === 0) {
      newErrors.detalles = 'Debes agregar al menos un producto'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      const submitData = {
        ...formData,
        subtotal: calcularTotal(),
        total: calcularTotal(),
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
            Proveedor *
          </label>
          <select
            name="proveedor"
            value={formData.proveedor}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              errors.proveedor ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <option value="">Seleccionar proveedor...</option>
            {proveedores.map(proveedor => (
              <option key={proveedor.id_proveedor} value={proveedor.id_proveedor}>
                {proveedor.nombre_empresa}
              </option>
            ))}
          </select>
          {errors.proveedor && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.proveedor}</p>
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
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Notas adicionales..."
        />
      </div>

      {/* Agregar Productos */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Productos</h3>
        
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
                  setPrecioUnitario(producto.precio_compra_unitario || '')
                }
                if (errors.producto) {
                  setErrors(prev => ({ ...prev, producto: '' }))
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.producto ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <option value="">Seleccionar producto...</option>
              {productos.map(producto => (
                <option key={producto.id_producto} value={producto.id_producto}>
                  {producto.sku_producto} - {producto.nombre}
                </option>
              ))}
            </select>
            {errors.producto && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.producto}</p>
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
              }}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.cantidad ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="0"
            />
            {errors.cantidad && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.cantidad}</p>
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
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.precioUnitario ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="0.00"
            />
            {errors.precioUnitario && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.precioUnitario}</p>
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
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{errors.detalles}</p>
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
              <tfoot className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <td colSpan="4" className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(calcularTotal())}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

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

export default OrdenCompraForm
