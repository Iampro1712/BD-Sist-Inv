import { useState, useMemo } from 'react'
import { Button } from '../ui'
import { useProductos } from '../../hooks/useProductos'
import { useCatalogoServicios } from '../../hooks/useTaller'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

/**
 * Arma el presupuesto de una orden de trabajo: qué se va a hacer (mano de obra
 * del catálogo) y qué piezas lleva. Los repuestos acá son una propuesta: no
 * salen del inventario hasta que el cliente aprueba.
 */
const PresupuestoForm = ({ orden, diagnosticoSugerido = '', onSubmit, onCancel, isLoading = false }) => {
  const [servicios, setServicios] = useState(() =>
    orden?.id_tipo_servicio
      ? [{
          servicio: String(orden.id_tipo_servicio),
          cantidad: 1,
          precio_unitario: orden.precio_mano_obra || 0,
        }]
      : []
  )
  const [productos, setProductos] = useState([])
  const [diagnostico, setDiagnostico] = useState(diagnosticoSugerido)
  const [validezDias, setValidezDias] = useState(15)
  const [notas, setNotas] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')

  const { data: catalogoData } = useCatalogoServicios()
  const { data: productosData } = useProductos({ search: busqueda, page_size: 20 })
  const catalogo = lista(catalogoData)
  const inventario = lista(productosData)

  const totalManoObra = useMemo(
    () => servicios.reduce((a, s) => a + (parseFloat(s.precio_unitario) || 0) * (parseInt(s.cantidad) || 0), 0),
    [servicios]
  )
  const totalRepuestos = useMemo(
    () => productos.reduce((a, p) => a + (parseFloat(p.precio_unitario) || 0) * (parseInt(p.cantidad) || 0), 0),
    [productos]
  )

  const agregarServicio = () => setServicios((s) => [...s, { servicio: '', cantidad: 1, precio_unitario: '' }])
  const agregarProducto = () => setProductos((p) => [...p, { producto: '', cantidad: 1, precio_unitario: '' }])

  const cambiarServicio = (i, campo, valor) => {
    setServicios((prev) => prev.map((s, idx) => {
      if (idx !== i) return s
      const next = { ...s, [campo]: valor }
      // Al elegir el tipo se trae su precio de mano de obra del catálogo.
      if (campo === 'servicio') {
        const t = catalogo.find((c) => String(c.id_servicio) === String(valor))
        if (t) next.precio_unitario = t.precio_mano_obra
      }
      return next
    }))
  }

  const cambiarProducto = (i, campo, valor) => {
    setProductos((prev) => prev.map((p, idx) => {
      if (idx !== i) return p
      const next = { ...p, [campo]: valor }
      if (campo === 'producto') {
        const prod = inventario.find((x) => String(x.id_producto) === String(valor))
        if (prod) next.precio_unitario = prod.precio_final
      }
      return next
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const serviciosValidos = servicios.filter((s) => s.servicio && parseInt(s.cantidad) > 0)
    const productosValidos = productos.filter((p) => p.producto && parseInt(p.cantidad) > 0)

    if (!serviciosValidos.length && !productosValidos.length) {
      setError('Agregá al menos una línea de mano de obra o un repuesto.')
      return
    }
    setError('')
    onSubmit({
      servicios: serviciosValidos.map((s) => ({
        servicio: parseInt(s.servicio),
        cantidad: parseInt(s.cantidad),
        precio_unitario: parseFloat(s.precio_unitario) || 0,
      })),
      productos: productosValidos.map((p) => ({
        producto: parseInt(p.producto),
        cantidad: parseInt(p.cantidad),
        precio_unitario: parseFloat(p.precio_unitario) || 0,
      })),
      diagnostico: diagnostico || null,
      validez_dias: parseInt(validezDias) || 15,
      notas: notas || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-sm">
        <p className="text-gray-900 dark:text-white font-medium">{orden?.moto_info}</p>
        <p className="text-gray-500 dark:text-gray-400">{orden?.cliente_nombre}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Diagnóstico
        </label>
        <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={2}
          placeholder="Qué se le encontró a la moto (va en el PDF del cliente)..."
          className={inputCls} />
      </div>

      {/* Mano de obra */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Mano de obra</h4>
          <button type="button" onClick={agregarServicio}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
            + Agregar trabajo
          </button>
        </div>
        {servicios.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Sin mano de obra.</p>
        ) : (
          <div className="space-y-2">
            {servicios.map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={s.servicio} onChange={(e) => cambiarServicio(i, 'servicio', e.target.value)}
                  className={`col-span-7 ${inputCls}`}>
                  <option value="">Selecciona el trabajo...</option>
                  {catalogo.map((c) => (
                    <option key={c.id_servicio} value={c.id_servicio}>
                      {c.nombre} — {formatCurrency(c.precio_mano_obra)}
                    </option>
                  ))}
                </select>
                <input type="number" min="1" value={s.cantidad}
                  onChange={(e) => cambiarServicio(i, 'cantidad', e.target.value)}
                  className={`col-span-2 ${inputCls}`} />
                <input type="number" min="0" step="0.01" value={s.precio_unitario}
                  onChange={(e) => cambiarServicio(i, 'precio_unitario', e.target.value)}
                  className={`col-span-2 ${inputCls}`} />
                <button type="button" onClick={() => setServicios((p) => p.filter((_, x) => x !== i))}
                  className="col-span-1 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Quitar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repuestos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Repuestos</h4>
          <button type="button" onClick={agregarProducto}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
            + Agregar repuesto
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          No salen del inventario hasta que el cliente apruebe el presupuesto.
        </p>
        {productos.length > 0 && (
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar repuesto para los selectores..." className={`mb-2 ${inputCls}`} />
        )}
        {productos.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Sin repuestos.</p>
        ) : (
          <div className="space-y-2">
            {productos.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={p.producto} onChange={(e) => cambiarProducto(i, 'producto', e.target.value)}
                  className={`col-span-7 ${inputCls}`}>
                  <option value="">Selecciona el repuesto...</option>
                  {inventario.map((x) => (
                    <option key={x.id_producto} value={x.id_producto}>
                      {x.nombre} — stock {x.cantidad_actual} — {formatCurrency(x.precio_final)}
                    </option>
                  ))}
                </select>
                <input type="number" min="1" value={p.cantidad}
                  onChange={(e) => cambiarProducto(i, 'cantidad', e.target.value)}
                  className={`col-span-2 ${inputCls}`} />
                <input type="number" min="0" step="0.01" value={p.precio_unitario}
                  onChange={(e) => cambiarProducto(i, 'precio_unitario', e.target.value)}
                  className={`col-span-2 ${inputCls}`} />
                <button type="button" onClick={() => setProductos((x) => x.filter((_, j) => j !== i))}
                  className="col-span-1 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Quitar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totales */}
      <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 space-y-1 text-sm">
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Mano de obra</span><span>{formatCurrency(totalManoObra)}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>Repuestos</span><span>{formatCurrency(totalRepuestos)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-white">
          <span>Total</span><span>{formatCurrency(totalManoObra + totalRepuestos)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Validez (días)
          </label>
          <input type="number" min="1" value={validezDias}
            onChange={(e) => setValidezDias(e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas
          </label>
          <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Opcional" className={inputCls} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creando...' : 'Crear presupuesto'}
        </Button>
      </div>
    </form>
  )
}

export default PresupuestoForm
