import { useState, useEffect } from 'react'
import { useOrdenesVenta, useOrdenVenta } from '../../hooks/useOrdenesVenta'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const DevolucionForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [ventaId, setVentaId] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [motivo, setMotivo] = useState('')
  // items: { producto, nombre, sku, max, precio_unitario, cantidad (a devolver) }
  const [items, setItems] = useState([])
  const [errors, setErrors] = useState({})

  const { data: ventasData } = useOrdenesVenta({ page: 1 })
  const { data: ventaDetalle } = useOrdenVenta(ventaId || null)

  const ventas = ventasData?.results || []

  // Al elegir una venta, cargar sus productos como candidatos a devolver
  useEffect(() => {
    if (ventaDetalle?.productos) {
      setItems(ventaDetalle.productos
        .filter(p => p.id_producto)  // ignora servicios sin producto
        .map(p => ({
          producto: p.id_producto,
          nombre: p.nombre,
          sku: p.sku,
          max: p.cantidad,
          precio_unitario: p.precio_unitario,
          cantidad: 0,
        })))
      setErrors({})
    } else {
      setItems([])
    }
  }, [ventaDetalle])

  const setCantidad = (idx, value) => {
    const v = Math.max(0, Math.min(parseInt(value) || 0, items[idx].max))
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, cantidad: v } : it)))
  }

  const seleccionados = items.filter(it => it.cantidad > 0)
  const total = seleccionados.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!ventaId) errs.venta = 'Selecciona la venta a la que pertenece la devolución'
    if (seleccionados.length === 0) errs.items = 'Indica al menos un producto y cantidad a devolver'
    setErrors(errs)
    if (Object.keys(errs).length) return

    onSubmit({
      venta: parseInt(ventaId),
      cliente: ventaDetalle?.id_cliente || null,
      fecha,
      motivo,
      detalles: seleccionados.map(it => ({
        producto: it.producto, cantidad: it.cantidad, precio_unitario: it.precio_unitario,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Venta asociada <span className="text-red-500">*</span>
          </label>
          <select value={ventaId} onChange={(e) => setVentaId(e.target.value)} className={inputCls(errors.venta)}>
            <option value="">Selecciona una venta...</option>
            {ventas.map(v => (
              <option key={v.id_venta} value={v.id_venta}>
                #{v.id_venta} · {v.cliente_nombre} · {formatCurrency(v.total)}
              </option>
            ))}
          </select>
          {errors.venta && <p className="mt-1 text-xs text-red-500">{errors.venta}</p>}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Se listan las ventas más recientes.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            max={new Date().toISOString().split('T')[0]} className={inputCls(false)} />
        </div>
      </div>

      {/* Productos de la venta */}
      {ventaId && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">Productos a devolver</h3>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Esta venta no tiene productos devolvibles.</p>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-24">Vendidos</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Precio</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">A devolver</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{it.nombre}</p>
                        {it.sku && <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{it.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{it.max}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatCurrency(it.precio_unitario)}</td>
                      <td className="px-4 py-3 text-right">
                        <input type="number" min="0" max={it.max} value={it.cantidad}
                          onChange={(e) => setCantidad(idx, e.target.value)}
                          className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-900 dark:bg-gray-700">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-300">Total a devolver (nota de crédito)</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-white">{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {errors.items && <p className="mt-2 text-xs text-red-500">{errors.items}</p>}
        </div>
      )}

      {/* Motivo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Motivo <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
          placeholder="Producto defectuoso, equivocado, etc." className={inputCls(false) + ' resize-none'} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">Al procesar, el stock de los productos se reingresa automáticamente.</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
            Cancelar
          </button>
          <Button type="submit" loading={isLoading} disabled={isLoading}>Procesar devolución</Button>
        </div>
      </div>
    </form>
  )
}

export default DevolucionForm
