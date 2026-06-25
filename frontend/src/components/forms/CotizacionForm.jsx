import { useState } from 'react'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const CotizacionForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    validez_dias: 15,
    notas: '',
    detalles: [],
  })
  const [errors, setErrors] = useState({})
  const [addError, setAddError] = useState({})
  const [selectedProducto, setSelectedProducto] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')

  const { data: clientesData } = useClientes()
  const { data: productosData } = useProductos({ activo: 'true' })
  const clientes = clientesData?.results || []
  const productos = productosData?.results || []

  const subtotalPreview =
    cantidad && precioUnitario ? parseInt(cantidad) * parseFloat(precioUnitario) : null

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleSelectProducto = (e) => {
    const id = e.target.value
    setSelectedProducto(id)
    const p = productos.find(pr => pr.id_producto === parseInt(id))
    if (p) setPrecioUnitario(String(p.precio_final || ''))
    setAddError({})
  }

  const handleAddProducto = () => {
    const errs = {}
    if (!selectedProducto) errs.producto = 'Selecciona un producto'
    else if (!cantidad || parseInt(cantidad) <= 0) errs.cantidad = 'Cantidad debe ser mayor a 0'
    else if (!precioUnitario || parseFloat(precioUnitario) <= 0) errs.precio = 'Precio debe ser mayor a 0'
    if (Object.keys(errs).length) { setAddError(errs); return }

    const p = productos.find(pr => pr.id_producto === parseInt(selectedProducto))
    if (!p) return
    const cantidadNum = parseInt(cantidad)

    const idx = formData.detalles.findIndex(d => d.producto === p.id_producto)
    if (idx >= 0) {
      const updated = [...formData.detalles]
      const nuevaCant = updated[idx].cantidad + cantidadNum
      updated[idx] = { ...updated[idx], cantidad: nuevaCant, subtotal: nuevaCant * parseFloat(precioUnitario) }
      setFormData(prev => ({ ...prev, detalles: updated }))
    } else {
      setFormData(prev => ({
        ...prev,
        detalles: [...prev.detalles, {
          producto: p.id_producto,
          producto_nombre: p.nombre,
          producto_codigo: p.sku_producto,
          cantidad: cantidadNum,
          precio_unitario: parseFloat(precioUnitario),
          subtotal: cantidadNum * parseFloat(precioUnitario),
        }],
      }))
    }
    setSelectedProducto(''); setCantidad(''); setPrecioUnitario(''); setAddError({})
    if (errors.detalles) setErrors(prev => ({ ...prev, detalles: '' }))
  }

  const handleRemoveProducto = (index) =>
    setFormData(prev => ({ ...prev, detalles: prev.detalles.filter((_, i) => i !== index) }))

  const calcularTotal = () => formData.detalles.reduce((s, d) => s + d.subtotal, 0)

  const validate = () => {
    const errs = {}
    if (!formData.cliente) errs.cliente = 'El cliente es requerido'
    if (!formData.fecha) errs.fecha = 'La fecha es requerida'
    if (parseInt(formData.validez_dias) <= 0) errs.validez_dias = 'La validez debe ser mayor a 0'
    if (formData.detalles.length === 0) errs.detalles = 'Agrega al menos un producto'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      cliente: parseInt(formData.cliente),
      fecha: formData.fecha,
      validez_dias: parseInt(formData.validez_dias),
      notas: formData.notas,
      detalles: formData.detalles.map(d => ({
        producto: d.producto, cantidad: d.cantidad, precio_unitario: d.precio_unitario,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos generales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cliente <span className="text-red-500">*</span>
          </label>
          <select name="cliente" value={formData.cliente} onChange={handleChange} className={inputCls(errors.cliente)}>
            <option value="">Selecciona...</option>
            {clientes.map(c => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>)}
          </select>
          {errors.cliente && <p className="mt-1 text-xs text-red-500">{errors.cliente}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input type="date" name="fecha" value={formData.fecha} onChange={handleChange}
            max={new Date().toISOString().split('T')[0]} className={inputCls(errors.fecha)} />
          {errors.fecha && <p className="mt-1 text-xs text-red-500">{errors.fecha}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Validez (días) <span className="text-red-500">*</span>
          </label>
          <input type="number" min="1" name="validez_dias" value={formData.validez_dias}
            onChange={handleChange} className={inputCls(errors.validez_dias)} />
          {errors.validez_dias && <p className="mt-1 text-xs text-red-500">{errors.validez_dias}</p>}
        </div>
      </div>

      {/* Agregar productos */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-4">Productos</h3>
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Producto</label>
              <select value={selectedProducto} onChange={handleSelectProducto} className={inputCls(addError.producto)}>
                <option value="">Seleccionar...</option>
                {productos.map(p => (
                  <option key={p.id_producto} value={p.id_producto}>{p.nombre} — Stock: {p.cantidad_actual}</option>
                ))}
              </select>
              {addError.producto && <p className="mt-1 text-xs text-red-500">{addError.producto}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cantidad</label>
              <input type="number" min="1" value={cantidad}
                onChange={(e) => { setCantidad(e.target.value); setAddError(p => ({ ...p, cantidad: '' })) }}
                className={inputCls(addError.cantidad)} placeholder="0" />
              {addError.cantidad && <p className="mt-1 text-xs text-red-500">{addError.cantidad}</p>}
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Precio unitario</label>
              <input type="number" step="0.01" min="0.01" value={precioUnitario}
                onChange={(e) => { setPrecioUnitario(e.target.value); setAddError(p => ({ ...p, precio: '' })) }}
                className={inputCls(addError.precio)} placeholder="0.00" />
              {addError.precio && <p className="mt-1 text-xs text-red-500">{addError.precio}</p>}
            </div>
            <div className="sm:col-span-2 flex flex-col justify-end">
              {subtotalPreview !== null && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 text-right">= {formatCurrency(subtotalPreview)}</p>
              )}
              <Button type="button" onClick={handleAddProducto} className="w-full">+ Agregar</Button>
            </div>
          </div>
        </div>

        {errors.detalles && <p className="mb-3 text-xs text-red-500">{errors.detalles}</p>}

        {formData.detalles.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-20">Cant.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Precio unit.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Subtotal</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {formData.detalles.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{d.producto_nombre}</p>
                      {d.producto_codigo && <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{d.producto_codigo}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">{d.cantidad}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatCurrency(d.precio_unitario)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(d.subtotal)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => handleRemoveProducto(i)}
                        className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Quitar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-900 dark:bg-gray-700">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-300">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-white">{formatCurrency(calcularTotal())}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea name="notas" value={formData.notas} onChange={handleChange} rows={2}
          placeholder="Condiciones, observaciones..." className={inputCls(false) + ' resize-none'} />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button type="button" onClick={onCancel} disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
          Cancelar
        </button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>Crear cotización</Button>
      </div>
    </form>
  )
}

export default CotizacionForm
