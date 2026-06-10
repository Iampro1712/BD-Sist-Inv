import { useState, useEffect } from 'react'
import { useClientes } from '../../hooks/useClientes'
import { useProductos } from '../../hooks/useProductos'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const OrdenVentaForm = ({ orden = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    descuento: 0,
    notas: '',
    detalles: [],
  })

  const [errors, setErrors]                   = useState({})
  const [addError, setAddError]               = useState({})
  const [selectedProducto, setSelectedProducto] = useState('')
  const [cantidad, setCantidad]               = useState('')
  const [precioUnitario, setPrecioUnitario]   = useState('')

  const { data: clientesData } = useClientes()
  const { data: productosData } = useProductos({ activo: 'true' })

  const clientes  = clientesData?.results  || []
  const productos = productosData?.results || []

  useEffect(() => {
    if (orden) {
      setFormData({
        cliente:   orden.cliente  || '',
        fecha:     orden.fecha    || new Date().toISOString().split('T')[0],
        descuento: orden.descuento || 0,
        notas:     orden.notas    || '',
        detalles:  orden.detalles || [],
      })
    }
  }, [orden])

  const productoSeleccionado = productos.find(p => p.id_producto === parseInt(selectedProducto))

  const subtotalPreview =
    cantidad && precioUnitario
      ? parseInt(cantidad) * parseFloat(precioUnitario)
      : null

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
    const cantidadEnCarrito = formData.detalles
      .filter(d => d.producto === p.id_producto)
      .reduce((s, d) => s + d.cantidad, 0)

    if (cantidadEnCarrito + cantidadNum > p.cantidad_actual) {
      setAddError({ stock: `Stock insuficiente. Disponible: ${p.cantidad_actual - cantidadEnCarrito}` })
      return
    }

    const existingIdx = formData.detalles.findIndex(d => d.producto === p.id_producto)
    if (existingIdx >= 0) {
      const updated = [...formData.detalles]
      updated[existingIdx] = {
        ...updated[existingIdx],
        cantidad: updated[existingIdx].cantidad + cantidadNum,
        subtotal: (updated[existingIdx].cantidad + cantidadNum) * parseFloat(precioUnitario),
      }
      setFormData(prev => ({ ...prev, detalles: updated }))
    } else {
      setFormData(prev => ({
        ...prev,
        detalles: [...prev.detalles, {
          producto:         p.id_producto,
          producto_nombre:  p.nombre,
          producto_codigo:  p.sku_producto,
          cantidad:         cantidadNum,
          precio_unitario:  parseFloat(precioUnitario),
          subtotal:         cantidadNum * parseFloat(precioUnitario),
          stock_disponible: p.cantidad_actual,
        }],
      }))
    }

    setSelectedProducto(''); setCantidad(''); setPrecioUnitario(''); setAddError({})
    if (errors.detalles) setErrors(prev => ({ ...prev, detalles: '' }))
  }

  const handleRemoveProducto = (index) => {
    setFormData(prev => ({ ...prev, detalles: prev.detalles.filter((_, i) => i !== index) }))
  }

  const calcularSubtotal = () => formData.detalles.reduce((s, d) => s + d.subtotal, 0)
  const calcularTotal    = () => calcularSubtotal() - (parseFloat(formData.descuento) || 0)

  const validate = () => {
    const errs = {}
    if (!formData.cliente) errs.cliente = 'El cliente es requerido'
    if (!formData.fecha)   errs.fecha   = 'La fecha es requerida'
    if (formData.detalles.length === 0) errs.detalles = 'Agrega al menos un producto'
    const desc = parseFloat(formData.descuento) || 0
    if (desc < 0)                   errs.descuento = 'El descuento no puede ser negativo'
    if (desc > calcularSubtotal())  errs.descuento = 'El descuento no puede superar el subtotal'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      cliente:   parseInt(formData.cliente),
      fecha:     formData.fecha,
      total:     calcularTotal(),
      detalles:  formData.detalles,
    })
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Paso 1: Datos generales ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Datos de la venta</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              name="cliente"
              value={formData.cliente}
              onChange={handleChange}
              className={inputCls(errors.cliente)}
            >
              <option value="">Selecciona un cliente...</option>
              {clientes.map(c => (
                <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
              ))}
            </select>
            {errors.cliente && <p className="mt-1 text-xs text-red-500">{errors.cliente}</p>}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="fecha"
              value={formData.fecha}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
              className={inputCls(errors.fecha)}
            />
            {errors.fecha && <p className="mt-1 text-xs text-red-500">{errors.fecha}</p>}
          </div>
        </div>
      </div>

      {/* ── Paso 2: Agregar productos ── */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Agregar productos</h3>
        </div>

        {/* Fila de agregar */}
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Selector de producto */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Producto</label>
              <select
                value={selectedProducto}
                onChange={handleSelectProducto}
                className={inputCls(addError.producto)}
              >
                <option value="">Seleccionar...</option>
                {productos.map(p => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.nombre} — Stock: {p.cantidad_actual}
                  </option>
                ))}
              </select>
              {addError.producto && <p className="mt-1 text-xs text-red-500">{addError.producto}</p>}
            </div>

            {/* Cantidad */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Cantidad
                {productoSeleccionado && (
                  <span className="ml-1 text-gray-400">(máx {productoSeleccionado.cantidad_actual})</span>
                )}
              </label>
              <input
                type="number"
                min="1"
                max={productoSeleccionado?.cantidad_actual}
                value={cantidad}
                onChange={(e) => { setCantidad(e.target.value); setAddError(p => ({ ...p, cantidad: '', stock: '' })) }}
                className={inputCls(addError.cantidad)}
                placeholder="0"
              />
              {addError.cantidad && <p className="mt-1 text-xs text-red-500">{addError.cantidad}</p>}
            </div>

            {/* Precio */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Precio unitario</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={precioUnitario}
                onChange={(e) => { setPrecioUnitario(e.target.value); setAddError(p => ({ ...p, precio: '' })) }}
                className={inputCls(addError.precio)}
                placeholder="0.00"
              />
              {addError.precio && <p className="mt-1 text-xs text-red-500">{addError.precio}</p>}
            </div>

            {/* Botón agregar */}
            <div className="sm:col-span-2 flex flex-col justify-end">
              {subtotalPreview !== null && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 text-right">
                  = {formatCurrency(subtotalPreview)}
                </p>
              )}
              <Button type="button" onClick={handleAddProducto} className="w-full">
                + Agregar
              </Button>
            </div>
          </div>

          {addError.stock && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {addError.stock}
            </div>
          )}
        </div>

        {errors.detalles && (
          <p className="mb-3 text-xs text-red-500">{errors.detalles}</p>
        )}

        {/* Tabla de productos agregados */}
        {formData.detalles.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-20">Cant.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Stock disp.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Precio unit.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Subtotal</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {formData.detalles.map((detalle, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{detalle.producto_nombre}</p>
                      {detalle.producto_codigo && (
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{detalle.producto_codigo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                      {detalle.cantidad}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${
                        detalle.stock_disponible - detalle.cantidad <= 0
                          ? 'text-red-500 dark:text-red-400'
                          : detalle.stock_disponible - detalle.cantidad <= 5
                          ? 'text-yellow-500 dark:text-yellow-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {detalle.stock_disponible - detalle.cantidad} restantes
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(detalle.precio_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(detalle.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveProducto(i)}
                        className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Quitar producto"
                      >
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
                  <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-300">Subtotal</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-white">{formatCurrency(calcularSubtotal())}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Paso 3: Descuento y notas ── */}
      {formData.detalles.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Descuento y notas</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Descuento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descuento <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.descuento}
                onChange={(e) => {
                  const val = e.target.value
                  const num = parseFloat(val)
                  if (val !== '' && (num < 0 || num > calcularSubtotal())) return
                  setFormData(prev => ({ ...prev, descuento: val }))
                  if (errors.descuento) setErrors(prev => ({ ...prev, descuento: '' }))
                }}
                className={inputCls(errors.descuento)}
                placeholder="0.00"
              />
              {errors.descuento && <p className="mt-1 text-xs text-red-500">{errors.descuento}</p>}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notas <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={handleChange}
                rows={2}
                placeholder="Observaciones sobre la venta..."
                className={inputCls(false) + ' resize-none'}
              />
            </div>
          </div>

          {/* Total final */}
          <div className="mt-4 bg-gray-900 dark:bg-gray-700 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">
                {parseFloat(formData.descuento) > 0 && `Subtotal ${formatCurrency(calcularSubtotal())} − descuento ${formatCurrency(parseFloat(formData.descuento))}`}
              </p>
              <p className="text-sm font-medium text-gray-300">Total a cobrar</p>
            </div>
            <span className="text-2xl font-bold text-white">{formatCurrency(calcularTotal())}</span>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          {orden ? 'Actualizar venta' : 'Crear venta'}
        </Button>
      </div>
    </form>
  )
}

export default OrdenVentaForm
