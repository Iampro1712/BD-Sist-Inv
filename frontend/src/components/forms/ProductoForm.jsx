import { useState, useEffect } from 'react'
import { useProveedores } from '../../hooks/useProveedores'
import { useUbicaciones } from '../../hooks/useUbicaciones'
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
    id_proveedor: '',
    meses_garantia: 0,
    tipo_garantia: '',
    descripcion_garantia: '',
    id_ubicacion: '',
  })

  const [errors, setErrors] = useState({})
  const { data: proveedoresData } = useProveedores()
  const proveedores = proveedoresData?.results || []
  const { data: ubicacionesData } = useUbicaciones()
  const ubicaciones = Array.isArray(ubicacionesData)
    ? ubicacionesData
    : ubicacionesData?.results || []

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
        id_proveedor: producto.id_proveedor || '',
        meses_garantia: producto.meses_garantia ?? 0,
        tipo_garantia: producto.tipo_garantia || '',
        descripcion_garantia: producto.descripcion_garantia || '',
        id_ubicacion: producto.id_ubicacion || '',
      })
    }
  }, [producto])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.sku_producto.trim()) newErrors.sku_producto = 'El código SKU es requerido'
    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido'
    if (!formData.precio_compra_unitario || parseFloat(formData.precio_compra_unitario) <= 0)
      newErrors.precio_compra_unitario = 'El precio de compra debe ser mayor a 0'
    if (!formData.precio_final || parseFloat(formData.precio_final) <= 0)
      newErrors.precio_final = 'El precio final debe ser mayor a 0'
    if (formData.cantidad_minima === '' || parseInt(formData.cantidad_minima) < 0)
      newErrors.cantidad_minima = 'La cantidad mínima no puede ser negativa'
    if (formData.cantidad_actual === '' || parseInt(formData.cantidad_actual) < 0)
      newErrors.cantidad_actual = 'La cantidad actual no puede ser negativa'
    if (formData.cantidad_total === '' || parseInt(formData.cantidad_total) < 0)
      newErrors.cantidad_total = 'La cantidad total no puede ser negativa'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    // El select vacío da '', que el backend rechaza como clave foránea.
    onSubmit({ ...formData, id_ubicacion: formData.id_ubicacion || null })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(value || 0)
  }

  const compra = parseFloat(formData.precio_compra_unitario) || 0
  const venta = parseFloat(formData.precio_final) || 0
  const margen = venta - compra
  const margenPct = compra > 0 ? ((margen / compra) * 100).toFixed(1) : null
  const margenPositivo = margen > 0

  const stockActual = parseInt(formData.cantidad_actual) || 0
  const stockMinimo = parseInt(formData.cantidad_minima) || 0
  const stockBajo = formData.cantidad_actual !== '' && formData.cantidad_minima !== '' && stockActual <= stockMinimo
  const tieneGarantia = parseInt(formData.meses_garantia) > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Identificación */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">1</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Identificación</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Código SKU *"
              name="sku_producto"
              value={formData.sku_producto}
              onChange={handleChange}
              error={errors.sku_producto}
              placeholder="Ej: OIL-CAST-20W50"
              disabled={!!producto}
            />
            {producto && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">El SKU no puede modificarse</p>
            )}
          </div>
          <Input
            label="Nombre del producto *"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            error={errors.nombre}
            placeholder="Nombre descriptivo"
          />
        </div>
      </div>

      {/* Proveedor */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">2</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Proveedor</h4>
        </div>
        <select
          name="id_proveedor"
          value={formData.id_proveedor}
          onChange={handleChange}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent border-gray-300 dark:border-gray-600 transition-colors"
        >
          <option value="">Sin proveedor asignado</option>
          {proveedores.map(p => (
            <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre_empresa}</option>
          ))}
        </select>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">
          Ubicación física
        </label>
        <select
          name="id_ubicacion"
          value={formData.id_ubicacion}
          onChange={handleChange}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent border-gray-300 dark:border-gray-600 transition-colors"
        >
          <option value="">Sin ubicación</option>
          {ubicaciones.map(u => (
            <option key={u.id_ubicacion} value={u.id_ubicacion}>{u.codigo}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Los lugares se administran en Ubicaciones.
        </p>
      </div>

      {/* Precios */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">3</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Precios</h4>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Precio de Compra *"
              name="precio_compra_unitario"
              type="number"
              step="1"
              min="0"
              value={formData.precio_compra_unitario}
              onChange={handleChange}
              error={errors.precio_compra_unitario}
              placeholder="0"
            />
            <Input
              label="Precio de Venta *"
              name="precio_final"
              type="number"
              step="0.01"
              min="0"
              value={formData.precio_final}
              onChange={handleChange}
              error={errors.precio_final}
              placeholder="0.00"
            />
          </div>

          {compra > 0 && venta > 0 && (
            <div className={`rounded-lg px-3 py-2.5 flex items-center gap-3 ${
              margenPositivo
                ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
            }`}>
              <svg className={`w-4 h-4 shrink-0 ${margenPositivo ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={margenPositivo
                  ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
              </svg>
              <div className="text-sm">
                <span className={`font-semibold ${margenPositivo ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  Margen: {formatCurrency(margen)}
                </span>
                {margenPct && (
                  <span className={`ml-2 text-xs ${margenPositivo ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                    ({margenPct}%)
                  </span>
                )}
                {!margenPositivo && (
                  <span className="ml-2 text-xs text-red-600 dark:text-red-400">— precio de venta menor al de compra</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inventario */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">4</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Inventario</h4>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Input
                label="Cantidad Mínima *"
                name="cantidad_minima"
                type="number"
                min="0"
                value={formData.cantidad_minima}
                onChange={handleChange}
                error={errors.cantidad_minima}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Umbral de alerta de stock bajo</p>
            </div>
            <div>
              <Input
                label="Cantidad Actual *"
                name="cantidad_actual"
                type="number"
                min="0"
                value={formData.cantidad_actual}
                onChange={handleChange}
                error={errors.cantidad_actual}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Unidades disponibles hoy</p>
            </div>
            <div>
              <Input
                label="Cantidad Total *"
                name="cantidad_total"
                type="number"
                min="0"
                value={formData.cantidad_total}
                onChange={handleChange}
                error={errors.cantidad_total}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Total histórico ingresado</p>
            </div>
          </div>

          {stockBajo && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-red-700 dark:text-red-300">
                La cantidad actual ({stockActual}) está por debajo del mínimo ({stockMinimo})
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Garantía */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">5</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Garantía</h4>
          {tieneGarantia && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {formData.meses_garantia} meses
            </span>
          )}
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Duración de garantía (meses)
              </label>
              <input
                type="number"
                name="meses_garantia"
                min="0"
                max="120"
                value={formData.meses_garantia}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent border-gray-300 dark:border-gray-600 transition-colors"
                placeholder="0 = sin garantía"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">0 = sin garantía</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Tipo de garantía
              </label>
              <select
                name="tipo_garantia"
                value={formData.tipo_garantia}
                onChange={handleChange}
                disabled={!tieneGarantia}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Seleccionar tipo</option>
                <option value="fabricante">Fabricante</option>
                <option value="proveedor">Proveedor</option>
                <option value="tienda">Tienda</option>
              </select>
            </div>
          </div>
          {tieneGarantia && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Descripción / Condiciones de garantía
              </label>
              <textarea
                name="descripcion_garantia"
                value={formData.descripcion_garantia}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent border-gray-300 dark:border-gray-600 transition-colors resize-none"
                placeholder="Ej: Cubre defectos de fabricación, no incluye daños por uso..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          {producto ? 'Guardar cambios' : 'Crear Producto'}
        </Button>
      </div>
    </form>
  )
}

export default ProductoForm
