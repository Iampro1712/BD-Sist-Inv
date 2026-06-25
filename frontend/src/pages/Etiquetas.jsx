import { useState } from 'react'
import { useProductos } from '../hooks/useProductos'
import { useDebounce } from '../hooks/useDebounce'
import { Button, Card } from '../components/ui'
import BarcodeLabel from '../components/productos/BarcodeLabel'

const Etiquetas = () => {
  const [query, setQuery] = useState('')
  // seleccion: { [id_producto]: { producto, copias } }
  const [seleccion, setSeleccion] = useState({})
  const debouncedQuery = useDebounce(query, 300)
  const { data } = useProductos({ search: debouncedQuery || undefined })
  const productos = data?.results || []

  const agregar = (p) => {
    setSeleccion((prev) => prev[p.id_producto]
      ? prev
      : { ...prev, [p.id_producto]: { producto: p, copias: 1 } })
  }
  const setCopias = (id, copias) => {
    const n = Math.max(1, Math.min(parseInt(copias) || 1, 200))
    setSeleccion((prev) => ({ ...prev, [id]: { ...prev[id], copias: n } }))
  }
  const quitar = (id) => setSeleccion((prev) => {
    const cp = { ...prev }; delete cp[id]; return cp
  })

  const items = Object.values(seleccion)
  const totalEtiquetas = items.reduce((s, it) => s + it.copias, 0)

  // Expandir a una etiqueta por copia para la impresión
  const etiquetasImprimir = items.flatMap((it) =>
    Array.from({ length: it.copias }, (_, i) => ({ key: `${it.producto.id_producto}-${i}`, producto: it.producto })))

  const imprimir = () => window.print()

  return (
    <div className="space-y-5">
      {/* Estilos de impresión: solo se imprime el área de etiquetas */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #etiquetas-print, #etiquetas-print * { visibility: visible !important; }
          #etiquetas-print { position: absolute; left: 0; top: 0; width: 100%; }
          .etiqueta { break-inside: avoid; }
        }
        .etiqueta {
          border: 1px solid #d1d5db; border-radius: 6px; padding: 6px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          background: #fff; color: #111;
        }
        .etiqueta-nombre { font-size: 11px; font-weight: 600; line-height: 1.1; margin-bottom: 2px;
          max-height: 26px; overflow: hidden; }
        .etiqueta-precio { font-size: 13px; font-weight: 700; margin-top: 2px; }
        .etiquetas-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;
        }
      `}</style>

      {/* Header (no se imprime) */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Etiquetas / Códigos de barras</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Genera etiquetas imprimibles con el código de barras del SKU</p>
        </div>
        <Button onClick={imprimir} disabled={totalEtiquetas === 0}>
          🖨️ Imprimir ({totalEtiquetas})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
        {/* Buscar y agregar */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-3">Productos</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 mb-3"
          />
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {productos.map((p) => (
              <button key={p.id_producto} onClick={() => agregar(p)}
                className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.nombre}</p>
                  <p className="text-xs font-mono text-gray-400">{p.sku_producto}</p>
                </div>
                <span className="text-xs text-primary-600 dark:text-primary-400 shrink-0">+ agregar</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Seleccionados */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-3">
            Seleccionados ({items.length})
          </h2>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Agrega productos para generar etiquetas</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map(({ producto, copias }) => (
                <div key={producto.id_producto} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{producto.nombre}</p>
                    <p className="text-xs font-mono text-gray-400">{producto.sku_producto}</p>
                  </div>
                  <input type="number" min="1" max="200" value={copias}
                    onChange={(e) => setCopias(producto.id_producto, e.target.value)}
                    className="w-16 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <span className="text-xs text-gray-400">copias</span>
                  <button onClick={() => quitar(producto.id_producto)} className="text-gray-300 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Vista previa / área de impresión */}
      {etiquetasImprimir.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 print:hidden">
            Vista previa
          </p>
          <div id="etiquetas-print" className="etiquetas-grid bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            {etiquetasImprimir.map((e) => (
              <BarcodeLabel key={e.key} producto={e.producto} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Etiquetas
