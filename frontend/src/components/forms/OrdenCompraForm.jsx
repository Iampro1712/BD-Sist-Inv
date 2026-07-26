import { useState, useEffect } from 'react'
import { useProveedores, usePreciosDeProducto } from '../../hooks/useProveedores'
import { useProductos } from '../../hooks/useProductos'
import { Button, Input } from '../ui'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const OrdenCompraForm = ({ orden = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    fecha_esperada: '',
    notas: '',
    detalles: [],
  })
  const [errors, setErrors] = useState({})
  const [selectedProducto, setSelectedProducto] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [addError, setAddError] = useState({})

  const { data: proveedoresData } = useProveedores()
  const { data: productosData } = useProductos({ activo: 'true', proveedor: formData.proveedor || undefined })

  const proveedores = proveedoresData?.results || []
  const productos   = productosData?.results   || []

  // Historial de precios del producto que se está agregando. Es la única forma
  // de ver que otro proveedor lo vendía más barato: el selector de productos
  // está filtrado por proveedor, así que la competencia no se ve por ningún lado.
  const { data: precios } = usePreciosDeProducto(selectedProducto || null)
  const proveedorActualId = parseInt(formData.proveedor) || null
  const precioDeEste = precios?.proveedores?.find(
    (p) => p.id_proveedor === proveedorActualId)
  const mejorOtro = precios?.proveedores?.find(
    (p) => p.id_proveedor !== proveedorActualId)
  const hayAhorro = precioDeEste && mejorOtro
    && mejorOtro.ultimo_precio < precioDeEste.ultimo_precio

  useEffect(() => {
    if (orden) {
      setFormData({
        proveedor: orden.proveedor || '',
        fecha:     orden.fecha     || new Date().toISOString().split('T')[0],
        notas:     orden.notas     || '',
        detalles:  orden.detalles  || [],
      })
    }
  }, [orden])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'proveedor') {
      // al cambiar proveedor, limpiar productos seleccionados
      setFormData(prev => ({ ...prev, proveedor: value, detalles: [] }))
      setSelectedProducto('')
      setCantidad('')
      setPrecioUnitario('')
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleAddProducto = () => {
    const errs = {}
    if (!selectedProducto)                              errs.producto       = 'Selecciona un producto'
    if (!cantidad || parseInt(cantidad) <= 0)           errs.cantidad       = 'Cantidad mayor a 0'
    if (!precioUnitario || parseFloat(precioUnitario) <= 0) errs.precioUnitario = 'Precio mayor a 0'
    if (Object.keys(errs).length) { setAddError(errs); return }

    const producto = productos.find(p => p.id_producto === parseInt(selectedProducto))
    if (!producto) return

    const yaExiste = formData.detalles.findIndex(d => d.producto === producto.id_producto)
    if (yaExiste !== -1) {
      // sumar cantidad si ya está en la lista
      setFormData(prev => ({
        ...prev,
        detalles: prev.detalles.map((d, i) =>
          i === yaExiste
            ? { ...d, cantidad: d.cantidad + parseInt(cantidad), subtotal: (d.cantidad + parseInt(cantidad)) * d.precio_unitario }
            : d
        ),
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        detalles: [...prev.detalles, {
          producto:         producto.id_producto,
          producto_nombre:  producto.nombre,
          producto_codigo:  producto.sku_producto,
          cantidad:         parseInt(cantidad),
          precio_unitario:  parseFloat(precioUnitario),
          subtotal:         parseInt(cantidad) * parseFloat(precioUnitario),
        }],
      }))
    }

    setSelectedProducto('')
    setCantidad('')
    setPrecioUnitario('')
    setAddError({})
  }

  const handleRemove = (index) => {
    setFormData(prev => ({ ...prev, detalles: prev.detalles.filter((_, i) => i !== index) }))
  }

  const total = formData.detalles.reduce((s, d) => s + d.subtotal, 0)

  const validate = () => {
    const errs = {}
    if (!formData.proveedor)         errs.proveedor = 'El proveedor es requerido'
    if (!formData.fecha)             errs.fecha     = 'La fecha es requerida'
    if (formData.detalles.length === 0) errs.detalles = 'Agrega al menos un producto'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      ...formData,
      // El input date vacío da '', que el backend rechaza como fecha.
      fecha_esperada: formData.fecha_esperada || null,
      subtotal: total,
      total,
    })
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const inputCls = (err) =>
    `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
      err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Paso 1 — Proveedor y fecha */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">1</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Datos generales</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <select
              name="proveedor"
              value={formData.proveedor}
              onChange={handleChange}
              className={inputCls(errors.proveedor)}
            >
              <option value="">Seleccionar proveedor…</option>
              {proveedores.map(p => (
                <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre_empresa}</option>
              ))}
            </select>
            {errors.proveedor && <p className="mt-1 text-xs text-red-500">{errors.proveedor}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
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

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Entrega prometida
            </label>
            <input
              type="date"
              name="fecha_esperada"
              value={formData.fecha_esperada}
              onChange={handleChange}
              min={formData.fecha}
              className={inputCls(false)}
            />
            {/* Sin esta fecha se puede medir cuánto tardó el proveedor, pero no
                si cumplió lo que prometió. */}
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Opcional. Es contra esto que se mide su puntualidad.
            </p>
          </div>
        </div>
      </div>

      {/* Paso 2 — Productos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">2</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Agregar productos</h4>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">

          {/* Selector de producto */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Producto</label>
            <select
              value={selectedProducto}
              disabled={!formData.proveedor}
              onChange={(e) => {
                setSelectedProducto(e.target.value)
                const p = productos.find(p => p.id_producto === parseInt(e.target.value))
                if (p) setPrecioUnitario(p.precio_compra_unitario || '')
                setAddError(prev => ({ ...prev, producto: '' }))
              }}
              className={inputCls(addError.producto) + (!formData.proveedor ? ' opacity-50 cursor-not-allowed' : '')}
            >
              <option value="">
                {!formData.proveedor ? '— Selecciona un proveedor primero —' : productos.length === 0 ? '— Sin productos disponibles —' : 'Seleccionar producto…'}
              </option>
              {formData.proveedor && productos.map(p => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.sku_producto} · {p.nombre}
                </option>
              ))}
            </select>
            {addError.producto && <p className="mt-1 text-xs text-red-500">{addError.producto}</p>}
          </div>

          {/* Cantidad + precio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Cantidad</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                disabled={!formData.proveedor}
                onChange={(e) => { setCantidad(e.target.value); setAddError(prev => ({ ...prev, cantidad: '' })) }}
                placeholder="0"
                className={inputCls(addError.cantidad) + (!formData.proveedor ? ' opacity-50 cursor-not-allowed' : '')}
              />
              {addError.cantidad && <p className="mt-1 text-xs text-red-500">{addError.cantidad}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Precio unitario</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={precioUnitario}
                disabled={!formData.proveedor}
                onChange={(e) => { setPrecioUnitario(e.target.value); setAddError(prev => ({ ...prev, precioUnitario: '' })) }}
                placeholder="0.00"
                className={inputCls(addError.precioUnitario) + (!formData.proveedor ? ' opacity-50 cursor-not-allowed' : '')}
              />
              {addError.precioUnitario && <p className="mt-1 text-xs text-red-500">{addError.precioUnitario}</p>}
            </div>
          </div>

          {/* Historial de precios: el único punto donde ver que otro proveedor
              lo vendía más barato sirve para cambiar la decisión. */}
          {selectedProducto && precios?.proveedores?.length > 0 && (
            <div className={`rounded-lg border p-3 text-sm ${
              hayAhorro
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700'
            }`}>
              {hayAhorro ? (
                <p className="text-amber-800 dark:text-amber-300">
                  <strong>{mejorOtro.proveedor}</strong> te lo vendió a{' '}
                  <strong>{formatCurrency(mejorOtro.ultimo_precio)}</strong>, contra{' '}
                  {formatCurrency(precioDeEste.ultimo_precio)} de este proveedor:{' '}
                  <strong>
                    {formatCurrency(precioDeEste.ultimo_precio - mejorOtro.ultimo_precio)}
                  </strong>{' '}
                  más barato por unidad.
                </p>
              ) : precioDeEste ? (
                <p className="text-gray-600 dark:text-gray-400">
                  A este proveedor se lo compraste por última vez a{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {formatCurrency(precioDeEste.ultimo_precio)}
                  </strong>
                  {precios.proveedores.length > 1 && ', y es el mejor precio que tenés'}.
                </p>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  A este proveedor nunca le compraste este producto. El mejor precio
                  que tenés es{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {formatCurrency(precios.mejor_precio)}
                  </strong>{' '}
                  de {precios.mejor_proveedor}.
                </p>
              )}
            </div>
          )}

          {/* Preview subtotal + botón */}
          <div className="flex items-center justify-between gap-3">
            {cantidad && precioUnitario && parseFloat(cantidad) > 0 && parseFloat(precioUnitario) > 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Subtotal: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(parseInt(cantidad) * parseFloat(precioUnitario))}</span>
              </p>
            ) : <span />}
            <Button type="button" onClick={handleAddProducto} disabled={!formData.proveedor} className="shrink-0">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </Button>
          </div>
        </div>

        {errors.detalles && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.detalles}
          </p>
        )}

        {/* Tabla de productos agregados */}
        {formData.detalles.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">Cant.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Precio unit.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Subtotal</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {formData.detalles.map((d, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{d.producto_nombre}</p>
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{d.producto_codigo}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{d.cantidad}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatCurrency(d.precio_unitario)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(d.subtotal)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemove(i)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
              <tfoot>
                <tr className="bg-gray-900 dark:bg-gray-700">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-300">Total</td>
                  <td className="px-4 py-3 text-right text-base font-bold text-white">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Paso 3 — Notas */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">3</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Notas adicionales <span className="font-normal text-gray-400">(opcional)</span></h4>
        </div>
        <textarea
          name="notas"
          value={formData.notas}
          onChange={handleChange}
          rows={2}
          placeholder="Instrucciones especiales, referencias, etc."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-colors"
        />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          {orden ? 'Actualizar orden' : 'Crear orden'}
        </Button>
      </div>
    </form>
  )
}

export default OrdenCompraForm
