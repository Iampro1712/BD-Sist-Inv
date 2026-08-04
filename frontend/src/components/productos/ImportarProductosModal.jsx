import { useState } from 'react'
import { Button } from '../ui'
import { useImportarProductos } from '../../hooks/useProductos'
import { useToast } from '../../hooks/useToast'
import { parseProductosFile, descargarPlantillaProductos } from '../../utils/importProductos'
import { extraerMensajeError } from '../../utils/errores'

const ImportarProductosModal = ({ onClose }) => {
  const [filas, setFilas] = useState([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [parseError, setParseError] = useState('')
  const [resultado, setResultado] = useState(null)
  const importar = useImportarProductos()
  const toast = useToast()

  const validas = filas.filter((f) => f.sku_producto && f.nombre)
  const invalidas = filas.length - validas.length

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(''); setResultado(null); setFilas([]); setNombreArchivo(file.name)
    try {
      const rows = await parseProductosFile(file)
      if (!rows.length) {
        setParseError('No se encontraron filas. Verifica que el archivo tenga encabezados (sku_producto, nombre, ...).')
        return
      }
      setFilas(rows)
    } catch (err) {
      setParseError(err.message || 'No se pudo leer el archivo')
    }
  }

  const handleImportar = async () => {
    if (!validas.length) return
    try {
      const res = await importar.mutateAsync(validas)
      setResultado(res.data)
      toast.success(`Importación: ${res.data.creados} creados, ${res.data.actualizados} actualizados`)
    } catch (err) {
      toast.error(extraerMensajeError(err, 'Error al importar'))
    }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  return (
    <div className="space-y-5">
      {/* Instrucciones */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        Sube un archivo <strong>.csv</strong> o <strong>.xlsx</strong> con columnas
        <span className="font-mono text-xs"> sku_producto, nombre, cantidad_actual, cantidad_minima, precio_compra_unitario, precio_final</span>.
        Los productos se identifican por <strong>SKU</strong>: si ya existe se actualiza, si no, se crea.
      </div>

      {/* Acciones de archivo */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Seleccionar archivo
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
        <button
          type="button"
          onClick={descargarPlantillaProductos}
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          Descargar plantilla CSV
        </button>
        {nombreArchivo && (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{nombreArchivo}</span>
        )}
      </div>

      {parseError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {parseError}
        </div>
      )}

      {/* Vista previa */}
      {filas.length > 0 && !resultado && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Vista previa ({validas.length} válidas{invalidas > 0 ? `, ${invalidas} sin SKU/nombre` : ''})
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-72 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Nombre</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Stock</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Costo</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Precio</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {filas.slice(0, 50).map((f, i) => {
                  const ok = f.sku_producto && f.nombre
                  return (
                    <tr key={i} className={ok ? '' : 'bg-red-50/50 dark:bg-red-900/10'}>
                      <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-300">{f.sku_producto || '—'}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{f.nombre || <span className="text-red-500">falta nombre</span>}</td>
                      <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{f.cantidad_actual ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{f.precio_compra_unitario != null ? formatCurrency(f.precio_compra_unitario) : '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{f.precio_final != null ? formatCurrency(f.precio_final) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filas.length > 50 && (
            <p className="mt-2 text-xs text-gray-400">Mostrando 50 de {filas.length} filas. Se importarán todas las válidas.</p>
          )}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{resultado.creados}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Creados</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{resultado.actualizados}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Actualizados</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{resultado.errores.length}</p>
              <p className="text-xs text-red-600 dark:text-red-400">Con error</p>
            </div>
          </div>
          {resultado.errores.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 max-h-40 overflow-y-auto text-xs">
              {resultado.errores.map((e, i) => (
                <div key={i} className="px-3 py-1.5 border-b border-red-100 dark:border-red-900/40 last:border-0 text-red-700 dark:text-red-400">
                  Fila {e.fila}{e.sku ? ` (${e.sku})` : ''}: {typeof e.error === 'string' ? e.error : JSON.stringify(e.error)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {resultado ? 'Cerrar' : 'Cancelar'}
        </button>
        {!resultado && (
          <Button onClick={handleImportar} loading={importar.isPending} disabled={importar.isPending || validas.length === 0}>
            Importar {validas.length > 0 ? `(${validas.length})` : ''}
          </Button>
        )}
      </div>
    </div>
  )
}

export default ImportarProductosModal
