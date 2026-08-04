import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { Button, Card, Loader, Combobox } from '../components/ui'
import { useToast } from '../hooks/useToast'
import { usePronosticoDemanda, useAnalisisIAPronostico } from '../hooks/useReportes'
import { extraerMensajeError } from '../utils/errores'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const URGENCIAS = {
  sin_stock: { texto: 'Sin stock', clase: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  critico: { texto: 'Pedir ya', clase: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  proximo: { texto: 'Se acerca', clase: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  ok: { texto: 'Alcanza', clase: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
}

// La confianza no es decorativa: dice si el número se puede usar para decidir.
const CONFIANZAS = {
  alta: { texto: 'alta', clase: 'text-green-600 dark:text-green-400' },
  media: { texto: 'media', clase: 'text-amber-600 dark:text-amber-400' },
  baja: { texto: 'baja', clase: 'text-red-600 dark:text-red-400' },
  sin_datos: { texto: 'sin datos', clase: 'text-gray-400 dark:text-gray-500' },
}

const FUENTES_PLAZO = {
  medido: 'plazo medido en recepciones reales',
  estimado: 'plazo cargado en el proveedor',
  default: 'plazo por defecto del sistema (nadie lo configuró)',
}

const PronosticoDemanda = () => {
  const [horizonte, setHorizonte] = useState(30)
  const [soloRecomprar, setSoloRecomprar] = useState(true)
  const [verSinHistorial, setVerSinHistorial] = useState(false)

  const toast = useToast()
  const { data, isLoading, error } = usePronosticoDemanda({ horizonte })
  const analisis = useAnalisisIAPronostico()

  const productos = data?.productos || []
  const visibles = useMemo(
    () => (soloRecomprar ? productos.filter((p) => p.cantidad_sugerida > 0) : productos),
    [productos, soloRecomprar])

  // Notas de la IA indexadas por producto, para pegarlas a su fila.
  const notasIA = useMemo(() => {
    const mapa = {}
    for (const n of analisis.data?.notas || []) mapa[n.producto] = n.nota
    return mapa
  }, [analisis.data])

  const pedirAnalisis = () => {
    const aRevisar = productos.filter((p) => p.cantidad_sugerida > 0)
    if (!aRevisar.length) {
      toast.info('No hay nada que recomprar: no hace falta gastar un análisis.')
      return
    }
    analisis.mutate(
      { productos: aRevisar, contexto: data?.contexto },
      {
        onSuccess: (res) => toast.success(`Análisis de ${res.proveedor} listo`),
        onError: (err) => toast.error(
          extraerMensajeError(err, 'No se pudo obtener el análisis')),
      })
  }

  const resumen = data?.resumen
  const contexto = data?.contexto
  const usaPlazoDefault = productos.some((p) => p.fuente_plazo === 'default')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pronóstico de demanda
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Qué recomprar, cuándo y cuánto, según lo que se vende y lo que tarda
            cada proveedor
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-44">
            <Combobox
              label="Quiero cubrir"
              value={horizonte}
              onChange={setHorizonte}
              options={[
                { value: 15, label: '15 días' },
                { value: 30, label: '30 días' },
                { value: 60, label: '60 días' },
                { value: 90, label: '90 días' },
              ]}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al calcular el pronóstico: {error.message}
        </div>
      )}

      {/* Cómo se calculó. Va arriba y no en una ayuda escondida: un número de
          compra sin su método es un número en el que no se puede confiar. */}
      {contexto && (
        <Card className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Calculado con las ventas de{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {contexto.meses_con_actividad} {contexto.meses_con_actividad === 1 ? 'mes' : 'meses'} con actividad
            </span>
            {contexto.primer_mes && ` (${contexto.primer_mes} a ${contexto.ultimo_mes})`}.
            El promedio se saca sobre esos meses, no sobre los transcurridos.
            {contexto.meses_sin_actividad?.length > 0 && (
              <>
                {' '}Se excluyeron{' '}
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {contexto.meses_sin_actividad.length}{' '}
                  {contexto.meses_sin_actividad.length === 1 ? 'mes' : 'meses'} sin ventas
                </span>{' '}
                ({contexto.meses_sin_actividad.join(', ')}): contarlos como cero
                haría ver la demanda más baja de lo que es.
              </>
            )}
            {usaPlazoDefault && (
              <>
                {' '}Algunos productos usan el plazo de entrega por defecto
                ({data.parametros.plazo_default_dias} días) porque su proveedor
                no lo tiene cargado — se puede ajustar en cada proveedor.
              </>
            )}
          </p>
        </Card>
      )}

      {resumen && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={fadeIn}>
            <Card className="p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Hay que recomprar</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {resumen.productos_a_recomprar}
                <span className="text-sm font-normal text-gray-400 dark:text-gray-500">
                  {' '}de {resumen.productos_analizados}
                </span>
              </p>
            </Card>
          </motion.div>
          <motion.div variants={fadeIn}>
            <Card className="p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Inversión sugerida</p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(resumen.inversion_sugerida)}
              </p>
            </Card>
          </motion.div>
          <motion.div variants={fadeIn}>
            <Card className="p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Urgentes</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {resumen.sin_stock + resumen.criticos}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {resumen.sin_stock} sin stock · {resumen.criticos} en el límite
              </p>
            </Card>
          </motion.div>
          <motion.div variants={fadeIn}>
            <Card className="p-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Poco confiables</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {resumen.confianza_baja}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                revisar a mano antes de comprar
              </p>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* La IA: opcional, bajo demanda y claramente separada de los números. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Interpretación con IA
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              Agrega la estacionalidad de Nicaragua y explica el contexto que los
              datos no pueden saber. <span className="font-medium">No cambia las
              cantidades</span>: los números de arriba son cuentas y no se tocan.
              Solo se le mandan productos y cantidades, ningún dato de cliente.
            </p>
          </div>
          <Button onClick={pedirAnalisis} loading={analisis.isPending}
            disabled={analisis.isPending || isLoading}>
            {analisis.isPending ? 'Analizando...' : 'Analizar'}
          </Button>
        </div>

        {analisis.isError && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            {extraerMensajeError(analisis.error, 'No se pudo obtener el análisis.')}
            {' '}El pronóstico de arriba no se ve afectado.
          </p>
        )}

        {analisis.data && (
          <div className="mt-4 space-y-3 text-sm">
            {analisis.data.resumen && (
              <p className="text-gray-700 dark:text-gray-300">{analisis.data.resumen}</p>
            )}
            {analisis.data.estacionalidad && (
              <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 px-3 py-2">
                <p className="text-xs font-medium text-primary-700 dark:text-primary-300 uppercase tracking-wider mb-1">
                  Época del año
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {analisis.data.estacionalidad}
                </p>
              </div>
            )}
            {analisis.data.agrupaciones?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Conviene pedir juntos
                </p>
                <ul className="space-y-1">
                  {analisis.data.agrupaciones.map((g, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{g.titulo}:</span>{' '}
                      {g.productos.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {analisis.data.proveedor} · {analisis.data.modelo} ·{' '}
              {analisis.data.analizados} productos analizados
            </p>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={soloRecomprar}
            onChange={(e) => setSoloRecomprar(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600" />
          Solo lo que hay que recomprar
        </label>
        {data?.sin_historial?.length > 0 && (
          <button onClick={() => setVerSinHistorial((v) => !v)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            {verSinHistorial ? 'Ocultar' : 'Ver'} {data.sin_historial.length} productos
            sin ventas registradas
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader /></div>
      ) : visibles.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {productos.length === 0
              ? 'Todavía no hay historial de ventas'
              : 'No hace falta comprar nada'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            {productos.length === 0
              ? 'El pronóstico necesita ventas registradas para calcular a qué velocidad se mueve cada producto.'
              : `Con el stock actual alcanza para cubrir los próximos ${horizonte} días.`}
          </p>
        </Card>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vende/mes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Le queda</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comprar</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {visibles.map((p) => {
                  const urgencia = URGENCIAS[p.urgencia] || URGENCIAS.ok
                  const confianza = CONFIANZAS[p.confianza] || CONFIANZAS.sin_datos
                  const nota = notasIA[p.nombre]
                  return (
                    <tr key={p.id_producto}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {p.nombre}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {p.proveedor || 'sin proveedor'} · entrega en {p.plazo_entrega_dias} d
                          {p.fuente_plazo !== 'medido' && (
                            <span title={FUENTES_PLAZO[p.fuente_plazo]}> (estimado)</span>
                          )}
                        </div>
                        {nota && (
                          <div className="mt-1 text-xs text-primary-700 dark:text-primary-300">
                            {nota}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                        {p.stock}
                        {p.en_camino > 0 && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500">
                            +{p.en_camino} en camino
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                        {p.velocidad_mensual}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                        {p.dias_cobertura === null ? '—' : `${p.dias_cobertura} d`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${p.cantidad_sugerida > 0
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-300 dark:text-gray-600'}`}>
                          {p.cantidad_sugerida}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                        {p.cantidad_sugerida > 0 ? formatCurrency(p.inversion) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${urgencia.clase}`}>
                          {urgencia.texto}
                        </span>
                        <span className={`block text-xs mt-0.5 ${confianza.clase}`}
                          title={`Basado en ${p.meses_con_venta} ${p.meses_con_venta === 1 ? 'mes' : 'meses'} con ventas`}>
                          confianza {confianza.texto}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {verSinHistorial && data?.sin_historial?.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Sin ventas registradas
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
            No se les calcula pronóstico: pueden ser productos nuevos o mercadería
            que no rota. Decidirlo requiere criterio, no una fórmula.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="text-left py-2">Producto</th>
                  <th className="text-right py-2">Stock</th>
                  <th className="text-right py-2">Capital parado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.sin_historial.map((p) => (
                  <tr key={p.id_producto}>
                    <td className="py-2 text-gray-900 dark:text-white">{p.nombre}</td>
                    <td className="py-2 text-right text-gray-500 dark:text-gray-400">{p.stock}</td>
                    <td className="py-2 text-right text-gray-900 dark:text-white">
                      {formatCurrency(p.capital_inmovilizado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default PronosticoDemanda
