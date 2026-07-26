import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { Card, Loader } from '../components/ui'
import { useDesempenoProveedores, useComparacionPrecios } from '../hooks/useProveedores'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-NI', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  }) : '—'

const TABS = [
  { id: 'desempeno', label: 'Desempeño' },
  { id: 'precios', label: 'Comparar precios' },
]

const AnalisisProveedores = () => {
  const [tab, setTab] = useState('desempeno')

  const { data: desempeno, isLoading: cargandoDesempeno, error: errorDesempeno } =
    useDesempenoProveedores(tab === 'desempeno')
  const { data: precios, isLoading: cargandoPrecios, error: errorPrecios } =
    useComparacionPrecios(tab === 'precios')

  const proveedores = desempeno?.proveedores || []
  const oportunidades = precios?.oportunidades || []
  const productos = precios?.productos || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Análisis de proveedores
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Quién entrega más rápido y quién cobra más caro por lo mismo, según el
          historial de compras
        </p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ------------------------------ DESEMPEÑO ------------------------------ */}
      {tab === 'desempeno' && (
        errorDesempeno ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
            Error al cargar el desempeño: {errorDesempeno.message}
          </div>
        ) : cargandoDesempeno ? (
          <div className="py-12 flex justify-center"><Loader /></div>
        ) : (
          <div className="space-y-4">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible"
              className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <motion.div variants={fadeIn}>
                <Card className="p-5">
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Proveedores</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {desempeno?.num_proveedores || 0}
                  </p>
                </Card>
              </motion.div>
              <motion.div variants={fadeIn}>
                <Card className="p-5">
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Comprado</p>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {formatCurrency(desempeno?.monto_total)}
                  </p>
                </Card>
              </motion.div>
              <motion.div variants={fadeIn}>
                <Card className="p-5">
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Más rápido</p>
                  <p className="text-base font-bold text-green-600 dark:text-green-400 truncate">
                    {desempeno?.mas_rapido || '—'}
                  </p>
                </Card>
              </motion.div>
              <motion.div variants={fadeIn}>
                <Card className="p-5">
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Más lento</p>
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400 truncate">
                    {desempeno?.mas_lento || '—'}
                  </p>
                </Card>
              </motion.div>
            </motion.div>

            {desempeno?.con_entregas_medibles === 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300">
                Todavía no hay compras recibidas, así que no se puede medir el tiempo
                de entrega. Los tiempos aparecen a medida que se reciben órdenes.
              </div>
            )}

            {!desempeno?.puntualidad_medible && desempeno?.con_entregas_medibles > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-600 dark:text-gray-400">
                La puntualidad no se puede calcular porque ninguna orden tiene fecha
                prometida. Al crear una compra se puede registrar la fecha que promete
                el proveedor, y ahí empieza a medirse.
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proveedor</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Órdenes</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entrega</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Puntualidad</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comprado</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Se le debe</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Última compra</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {proveedores.map((p) => (
                      <tr key={p.id_proveedor} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{p.proveedor}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {p.productos_distintos} producto(s)
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">
                          {p.ordenes}
                          {p.recibidas < p.ordenes && (
                            <span className="block text-xs text-gray-400">
                              {p.recibidas} recibidas
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {p.dias_promedio === null ? (
                            <span className="text-xs text-gray-400 dark:text-gray-500">sin datos</span>
                          ) : (
                            <>
                              <span className={`text-sm font-semibold ${
                                p.dias_promedio <= 4 ? 'text-green-600 dark:text-green-400'
                                  : p.dias_promedio <= 8 ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {p.dias_promedio} días
                              </span>
                              <span className="block text-xs text-gray-400 dark:text-gray-500">
                                {p.dias_min}–{p.dias_max}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {p.puntualidad === null ? (
                            <span className="text-xs text-gray-400 dark:text-gray-500">n/d</span>
                          ) : (
                            <>
                              <span className={`text-sm font-semibold ${
                                p.puntualidad >= 80 ? 'text-green-600 dark:text-green-400'
                                  : p.puntualidad >= 50 ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {p.puntualidad}%
                              </span>
                              <span className="block text-xs text-gray-400 dark:text-gray-500">
                                de {p.ordenes_con_promesa}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(p.monto_comprado)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          {p.saldo_pendiente > 0 ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {formatCurrency(p.saldo_pendiente)}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(p.ultima_compra)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* ---------------------------- COMPARAR PRECIOS ---------------------------- */}
      {tab === 'precios' && (
        errorPrecios ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
            Error al cargar la comparación: {errorPrecios.message}
          </div>
        ) : cargandoPrecios ? (
          <div className="py-12 flex justify-center"><Loader /></div>
        ) : (
          <div className="space-y-5">
            {precios?.productos_con_historial === 0 ? (
              <Card className="p-12 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Todavía no hay historial de precios
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  La comparación se arma con las compras registradas. En cuanto se
                  compre un mismo producto a más de un proveedor, aparece acá.
                </p>
              </Card>
            ) : (
              <>
                {/* Lo accionable primero */}
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Oportunidades de ahorro
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {precios.num_oportunidades} producto(s) · hasta{' '}
                      <strong>{formatCurrency(precios.ahorro_unitario_total)}</strong> por
                      unidad si se cambia de proveedor
                    </p>
                  </div>

                  {oportunidades.length === 0 ? (
                    <Card className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Cada producto ya está asignado al proveedor que lo dio más
                      barato. Nada que cambiar.
                    </Card>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Proveedor actual</th>
                              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Paga</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Mejor opción</th>
                              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pagaría</th>
                              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Ahorro</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                            {oportunidades.map((o) => (
                              <tr key={o.id_producto} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-5 py-3">
                                  <p className="text-sm text-gray-900 dark:text-white">{o.nombre}</p>
                                  <p className="text-xs font-mono text-gray-400">{o.sku}</p>
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">{o.proveedor_actual}</td>
                                <td className="px-5 py-3 text-right text-sm text-gray-900 dark:text-white">
                                  {formatCurrency(o.precio_actual)}
                                </td>
                                <td className="px-5 py-3 text-sm font-medium text-green-700 dark:text-green-400">
                                  {o.mejor_proveedor}
                                </td>
                                <td className="px-5 py-3 text-right text-sm text-green-700 dark:text-green-400">
                                  {formatCurrency(o.mejor_precio)}
                                </td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-green-600 dark:text-green-400">
                                  −{formatCurrency(o.ahorro_unitario)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detalle por producto */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Precio de cada proveedor
                    <span className="ml-2 font-normal text-xs text-gray-400 dark:text-gray-500">
                      {precios.productos_comparables} producto(s) comprados a más de un proveedor
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {productos.map((p) => (
                      <Card key={p.id_producto} className="p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.nombre}</p>
                            <p className="text-xs font-mono text-gray-400">{p.sku}</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            entre el más caro y el más barato:{' '}
                            <strong className="text-gray-900 dark:text-white">
                              {formatCurrency(p.diferencia)}
                            </strong>
                          </p>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {[...p.proveedores].sort((a, b) => a.ultimo_precio - b.ultimo_precio).map((prov) => (
                            <div key={prov.id_proveedor}
                              className="flex items-center justify-between gap-3 py-1.5 text-sm">
                              <span className={prov.es_mejor_precio
                                ? 'font-semibold text-green-700 dark:text-green-400'
                                : 'text-gray-700 dark:text-gray-300'}>
                                {prov.proveedor}
                                {prov.es_mejor_precio && ' · más barato'}
                              </span>
                              <span className="flex items-center gap-4 shrink-0">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {prov.veces_comprado}x · {formatDate(prov.ultima_fecha)}
                                </span>
                                <span className={`font-semibold ${prov.es_mejor_precio
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-gray-900 dark:text-white'}`}>
                                  {formatCurrency(prov.ultimo_precio)}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default AnalisisProveedores
