import { useState, useEffect } from 'react'
import { Input, Button } from '../ui'

const ProductoForm = ({ producto = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    sku_producto: '',
    nombre: '',
    cantidad_actual: '',
    cantidad_minima: '',
    cantidad_total: '',
    precio_compra_unitario: '',
    precio_final: '',
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (producto) {
      setFormData({
        sku_producto: producto.sku_producto || '',
        nombre: producto.nombre || '',
        cantidad_actual: producto.cantidad_actual || '',
        cantidad_minima: producto.cantidad_minima || '',
        cantidad_total: producto.cantidad_total || '',
        precio_compra_unitario: producto.precio_compra_unitario || '',
        precio_final: producto.precio_final || '',
      })
    }
  }, [producto])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.sku_producto.trim()) newErrors.sku_producto = 'El código SKU es requerido'
    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido'
    if (!formData.precio_compra_unitario || parseFloat(formData.precio_compra_unitario) <= 0) {
      newErrors.precio_compra_unitario = 'El precio de compra debe ser mayor a 0'
    }
    if (!formData.precio_final || parseFloat(formData.precio_final) <= 0) {
      newErrors.precio_final = 'El precio final debe ser mayor a 0'
    }
    if (!formData.cantidad_minima || parseInt(formData.cantidad_minima) < 0) {
      newErrors.cantidad_minima = 'La cantidad mínima no puede ser negativa'
    }
    if (!formData.cantidad_actual || parseInt(formData.cantidad_actual) < 0) {
      newErrors.cantidad_actual = 'La cantidad actual no puede ser negativa'
    }
    if (!formData.cantidad_total || parseInt(formData.cantidad_total) < 0) {
      newErrors.cantidad_total = 'La cantidad total no puede ser negativa'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Código SKU *"
          name="sku_producto"
          value={formData.sku_producto}
          onChange={handleChange}
          error={errors.sku_producto}
          placeholder="Ej: OIL-CAST-20W50"
          disabled={!!producto}
        />

        <Input
          label="Nombre *"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          error={errors.nombre}
          placeholder="Nombre del producto"
        />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Precios</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Precio de Compra Unitario *"
            name="precio_compra_unitario"
            type="number"
            step="1"
            value={formData.precio_compra_unitario}
            onChange={handleChange}
            error={errors.precio_compra_unitario}
            placeholder="0"
          />

          <Input
            label="Precio Final (Venta) *"
            name="precio_final"
            type="number"
            step="0.01"
            value={formData.precio_final}
            onChange={handleChange}
            error={errors.precio_final}
            placeholder="0.00"
          />
        </div>
        {formData.precio_compra_unitario && formData.precio_final && (
          <div className="mt-3 text-sm text-blue-700 dark:text-blue-400">
            <p>Margen de ganancia: {formatCurrency(parseFloat(formData.precio_final) - parseFloat(formData.precio_compra_unitario))}</p>
          </div>
        )}
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-3">Inventario</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Cantidad Mínima *"
            name="cantidad_minima"
            type="number"
            value={formData.cantidad_minima}
            onChange={handleChange}
            error={errors.cantidad_minima}
            placeholder="0"
          />

          <Input
            label="Cantidad Actual *"
            name="cantidad_actual"
            type="number"
            value={formData.cantidad_actual}
            onChange={handleChange}
            error={errors.cantidad_actual}
            placeholder="0"
          />

          <Input
            label="Cantidad Total *"
            name="cantidad_total"
            type="number"
            value={formData.cantidad_total}
            onChange={handleChange}
            error={errors.cantidad_total}
            placeholder="0"
          />
        </div>
        {formData.cantidad_actual && formData.cantidad_minima && parseInt(formData.cantidad_actual) <= parseInt(formData.cantidad_minima) && (
          <div className="mt-3 flex items-center text-sm text-red-600 dark:text-red-400">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Advertencia: La cantidad actual está por debajo del mínimo
          </div>
        )}
      </div>

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
          {producto ? 'Actualizar' : 'Crear'} Producto
        </Button>
      </div>
    </form>
  )
}

export default ProductoForm
