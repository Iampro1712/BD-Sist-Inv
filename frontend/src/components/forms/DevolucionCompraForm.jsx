import { useState, useMemo } from 'react'
import { Button } from '../ui'
import { useOrdenesCompra } from '../../hooks/useOrdenesCompra'
import { useDevolvible } from '../../hooks/useDevoluciones'
import { useCajaActual } from '../../hooks/useCaja'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-NI', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  }) : ''

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const METODOS = [
  { value: 'credito', label: 'Nota de crédito (queda a favor)' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'cheque', label: 'Cheque' },
]

/**
 * Registrar mercadería devuelta a un proveedor. Siempre contra una compra ya
 * recibida: es lo que permite validar cantidades y saber de qué deuda descontar.
 */
const DevolucionCompraForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [idOrden, setIdOrden] = useState('')
  const [cantidades, setCantidades] = useState({})   // { id_producto: '3' }
  const [motivo, setMotivo] = useState('')
  const [reembolso, setReembolso] = useState('')
  const [metodo, setMetodo] = useState('credito')
  const [error, setError] = useState('')

  // Solo compras recibidas: de una que no llegó no hay nada que devolver.
  const { data: ordenesData } = useOrdenesCompra({ estado: 'recibida', page_size: 100 })
  const { data: devolvible, isLoading: cargandoDevolvible } = useDevolvible(idOrden || null)
  const { data: caja } = useCajaActual()

  const ordenes = lista(ordenesData)
  const productos = devolvible?.productos || []
  const cajaAbierta = !!caja

  const total = useMemo(
    () => productos.reduce((acc, p) => {
      const n = parseInt(cantidades[p.id_producto]) || 0
      return acc + n * p.precio_unitario
    }, 0),
    [productos, cantidades]
  )

  const esEfectivoSinCaja = metodo === 'efectivo' && parseFloat(reembolso) > 0 && !cajaAbierta

  const handleSubmit = (e) => {
    e.preventDefault()
    const detalles = productos
      .map((p) => ({ producto: p.id_producto, cantidad: parseInt(cantidades[p.id_producto]) || 0 }))
      .filter((d) => d.cantidad > 0)

    if (!idOrden) { setError('Elegí la compra de la que vas a devolver'); return }
    if (!detalles.length) { setError('Indicá al menos un producto y su cantidad'); return }

    const excedido = productos.find((p) => {
      const n = parseInt(cantidades[p.id_producto]) || 0
      return n > p.max_devolvible
    })
    if (excedido) {
      setError(`De "${excedido.nombre}" solo se pueden devolver ${excedido.max_devolvible}`)
      return
    }
    if (esEfectivoSinCaja) {
      setError('Un reembolso en efectivo entra al cajón: abrí la caja o elegí otro método')
      return
    }

    setError('')
    onSubmit({
      orden: parseInt(idOrden),
      detalles,
      motivo: motivo || null,
      reembolso: parseFloat(reembolso) || 0,
      metodo_reembolso: metodo,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Compra <span className="text-red-500">*</span>
        </label>
        <select value={idOrden}
          onChange={(e) => { setIdOrden(e.target.value); setCantidades({}); setError('') }}
          className={inputCls(false)}>
          <option value="">Selecciona la compra recibida...</option>
          {ordenes.map((o) => (
            <option key={o.id_orden} value={o.id_orden}>
              #{o.id_orden} · {o.proveedor_nombre} · {formatDate(o.fecha_creacion)} · {formatCurrency(o.total)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Solo aparecen las compras ya recibidas.
        </p>
      </div>

      {idOrden && (
        cargandoDevolvible ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-3">Cargando productos...</p>
        ) : !devolvible?.puede_devolverse ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
            {devolvible?.motivo
              || 'No queda nada por devolver de esta compra: ya se devolvió todo o la mercadería ya no está en inventario.'}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Qué se devuelve
            </label>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              {productos.map((p) => (
                <div key={p.id_producto} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatCurrency(p.precio_unitario)} · recibidos {p.recibido}
                      {p.ya_devuelto > 0 && ` · ya devueltos ${p.ya_devuelto}`}
                      {' · '}en stock {p.stock_actual}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="number" min="0" max={p.max_devolvible}
                      value={cantidades[p.id_producto] || ''}
                      onChange={(e) => setCantidades((prev) => ({
                        ...prev, [p.id_producto]: e.target.value,
                      }))}
                      disabled={p.max_devolvible === 0}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-40" />
                    <span className="text-xs text-gray-400 dark:text-gray-500 w-16">
                      {p.max_devolvible === 0 ? 'sin stock' : `máx. ${p.max_devolvible}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Motivo
        </label>
        <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Defectuosos, equivocados, dañados en el envío..."
          className={inputCls(false)} />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Sirve para saber después qué proveedor manda mercadería con problemas.
        </p>
      </div>

      {/* Reembolso */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ¿El proveedor devolvió el dinero?
          </p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            A devolver: {formatCurrency(total)}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Monto reembolsado
            </label>
            <input type="number" min="0" step="0.01" value={reembolso}
              onChange={(e) => setReembolso(e.target.value)} placeholder="0.00"
              className={inputCls(false)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Método
            </label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
              className={inputCls(false)}>
              {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Si no reembolsa nada, lo devuelto baja la deuda de esa compra; si ya estaba
          pagada, queda como saldo a favor.
        </p>
        {esEfectivoSinCaja && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-300">
            No hay caja abierta. Un reembolso en efectivo entra al cajón, así que
            necesitás abrir la caja o elegir otro método.
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || total <= 0}>
          {isLoading ? 'Registrando...' : 'Registrar devolución'}
        </Button>
      </div>
    </form>
  )
}

export default DevolucionCompraForm
