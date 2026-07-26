import { useState, useMemo } from 'react'
import { Button, Card, Loader, ConfirmDialog } from '../components/ui'
import { useToast } from '../hooks/useToast'
import { useConteoFisico, useAplicarConteo, useUbicaciones } from '../hooks/useUbicaciones'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])

const extraerMensajeError = (err, fallback) => {
  const data = err.response?.data
  const details = data?.error?.details
  if (details && typeof details === 'object') {
    const primero = Object.values(details)[0]
    if (primero) return Array.isArray(primero) ? primero[0] : primero
  }
  const message = data?.error?.message
  if (typeof message === 'string') return message
  if (typeof data?.error === 'string') return data.error
  return fallback
}

const ConteoFisico = () => {
  const [bodega, setBodega] = useState('')
  // { [id_producto]: '12' }  — string para poder distinguir vacío de cero
  const [contados, setContados] = useState({})
  const [confirmar, setConfirmar] = useState(false)

  const toast = useToast()
  const { data, isLoading, error } = useConteoFisico(bodega ? { bodega } : {})
  const { data: ubicacionesData } = useUbicaciones()
  const aplicar = useAplicarConteo()

  const bodegas = [...new Set(lista(ubicacionesData).map((u) => u.bodega))].sort()
  const grupos = data?.grupos || []

  // Solo cuentan las filas donde se anotó algo: dejar en blanco significa
  // "no lo conté", no "hay cero".
  const resumen = useMemo(() => {
    let anotados = 0, cuadran = 0, sobran = 0, faltan = 0, impacto = 0
    grupos.forEach((g) => g.productos.forEach((p) => {
      const valor = contados[p.id_producto]
      if (valor === undefined || valor === '') return
      const n = parseInt(valor)
      if (Number.isNaN(n)) return
      anotados++
      const diferencia = n - p.sistema
      if (diferencia === 0) cuadran++
      else if (diferencia > 0) sobran++
      else faltan++
      impacto += diferencia * p.precio
    }))
    return { anotados, cuadran, sobran, faltan, impacto }
  }, [grupos, contados])

  const handleAplicar = () => {
    const conteos = Object.entries(contados)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([id, v]) => ({ id_producto: parseInt(id), contado: parseInt(v) }))

    aplicar.mutate({ conteos }, {
      onSuccess: (res) => {
        const d = res.data
        toast.success(
          `Conteo aplicado: ${d.cuadrados} cuadraron, ${d.ajustados} ajustados ` +
          `(${d.sobrantes} sobrantes, ${d.faltantes} faltantes)`
        )
        setContados({})
        setConfirmar(false)
      },
      onError: (err) => {
        toast.error(extraerMensajeError(err, 'No se pudo aplicar el conteo'))
        setConfirmar(false)
      },
    })
  }

  return (
    <div className="space-y-5">
      {/* Al imprimir solo sale la hoja, igual que en Etiquetas */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #conteo-print, #conteo-print * { visibility: visible !important; }
          #conteo-print { position: absolute; left: 0; top: 0; width: 100%; }
          .grupo-conteo { break-inside: avoid; }
          .celda-anotar { border-bottom: 1px solid #9ca3af; min-width: 60px; display: inline-block; }
        }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conteo físico</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Recorré la tienda estante por estante: la hoja va ordenada por ubicación
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bodegas.length > 1 && (
            <select value={bodega} onChange={(e) => { setBodega(e.target.value); setContados({}) }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Todas las bodegas</option>
              {bodegas.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <Button variant="secondary" onClick={() => window.print()}>🖨️ Imprimir hoja</Button>
          <Button onClick={() => setConfirmar(true)} disabled={resumen.anotados === 0}>
            Aplicar conteo ({resumen.anotados})
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm print:hidden">
          Error al cargar el conteo: {error.message}
        </div>
      )}

      {/* Resumen en vivo */}
      {resumen.anotados > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <Card className="p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Cuadran</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{resumen.cuadran}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Faltantes</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{resumen.faltan}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Sobrantes</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{resumen.sobran}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Impacto</p>
            <p className={`text-xl font-bold ${
              resumen.impacto < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
            }`}>
              {formatCurrency(resumen.impacto)}
            </p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader /></div>
      ) : (
        <div id="conteo-print" className="space-y-5">
          <div className="hidden print:block mb-4">
            <h2 className="text-lg font-bold">JC Motoshop — Hoja de conteo físico</h2>
            <p className="text-sm">
              {new Date().toLocaleDateString('es-NI', { day: 'numeric', month: 'long', year: 'numeric' })}
              {bodega ? ` · Bodega ${bodega}` : ''} · {data?.total_productos || 0} productos
            </p>
          </div>

          {data?.sin_ubicacion > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300 print:hidden">
              Hay {data.sin_ubicacion} producto(s) sin ubicación asignada. Van al final de la hoja
              para que no queden fuera del conteo.
            </div>
          )}

          {grupos.map((g) => (
            <div key={g.id_ubicacion ?? 'sin'} className="grupo-conteo">
              <h3 className={`text-sm font-bold mb-2 ${
                g.sin_ubicacion
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {g.ubicacion}
                <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">
                  ({g.productos.length})
                </span>
              </h3>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-20">Sistema</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-24">Contado</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-20">Dif.</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {g.productos.map((p) => {
                      const valor = contados[p.id_producto] ?? ''
                      const n = valor === '' ? null : parseInt(valor)
                      const dif = n === null || Number.isNaN(n) ? null : n - p.sistema
                      return (
                        <tr key={p.id_producto}>
                          <td className="px-3 py-2 text-xs font-mono text-gray-400 dark:text-gray-500">{p.sku}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">{p.nombre}</td>
                          <td className="px-3 py-2 text-right text-sm text-gray-700 dark:text-gray-300">{p.sistema}</td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" min="0" value={valor}
                              onChange={(e) => setContados((prev) => ({
                                ...prev, [p.id_producto]: e.target.value,
                              }))}
                              className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white print:hidden" />
                            <span className="celda-anotar hidden print:inline-block">&nbsp;</span>
                          </td>
                          <td className={`px-3 py-2 text-right text-sm font-semibold ${
                            dif === null ? 'text-gray-300 dark:text-gray-600'
                              : dif === 0 ? 'text-green-600 dark:text-green-400'
                              : dif > 0 ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {dif === null ? '—' : dif > 0 ? `+${dif}` : dif}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={handleAplicar}
        closeOnConfirm={false}
        title="Aplicar el conteo al inventario"
        message={
          `Se ajustarán ${resumen.sobran + resumen.faltan} producto(s) con diferencia ` +
          `(${formatCurrency(resumen.impacto)} de impacto). Los ${resumen.cuadran} que cuadran ` +
          `no se tocan. Esto modifica el stock y queda registrado en los movimientos.`
        }
        confirmText="Aplicar"
        loading={aplicar.isPending}
      />
    </div>
  )
}

export default ConteoFisico
