import { useState } from 'react'
import { Button, Card, Modal } from '../components/ui'
import { useToast } from '../hooks/useToast'
import { useCajaActual } from '../hooks/useCaja'
import {
  useGastos, useCategoriasGasto, useCrearGasto, useEliminarGasto,
  useCrearCategoriaGasto, useEstadoResultados,
} from '../hooks/useGastos'
import GastoForm from '../components/forms/GastoForm'
import CategoriaGastoForm from '../components/forms/CategoriaGastoForm'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const fmtFecha = (s) => (s ? new Date(s).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : '—')

// Extrae el primer mensaje legible del formato de error del backend.
const errMsg = (err, fallback) => {
  const details = err.response?.data?.error?.details
  if (details && typeof details === 'object') {
    const primero = Object.values(details)[0]
    if (primero) return Array.isArray(primero) ? primero[0] : primero
  }
  const message = err.response?.data?.error?.message
  return typeof message === 'string' ? message : fallback
}

const hoy = () => new Date().toISOString().split('T')[0]
const inicioMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

const Gastos = () => {
  const toast = useToast()
  const [tab, setTab] = useState('libro')
  const [modal, setModal] = useState(null) // 'gasto' | 'categoria' | null
  const [filtros, setFiltros] = useState({ fecha_inicio: inicioMes(), fecha_fin: hoy(), categoria: '' })
  const [rango, setRango] = useState({ fecha_inicio: inicioMes(), fecha_fin: hoy() })

  const { data: cajaActual } = useCajaActual()
  const cajaAbierta = !!cajaActual
  const { data: gastosData } = useGastos(filtros)
  const { data: categorias } = useCategoriasGasto()
  const crearGasto = useCrearGasto()
  const eliminarGasto = useEliminarGasto()
  const crearCategoria = useCrearCategoriaGasto()
  const { data: estado } = useEstadoResultados(rango, tab === 'resultados')

  const gastos = Array.isArray(gastosData) ? gastosData : (gastosData?.results || [])
  const cats = Array.isArray(categorias) ? categorias : (categorias?.results || [])
  const totalGastos = gastos.reduce((s, g) => s + parseFloat(g.monto || 0), 0)

  const handleCrearGasto = async (data) => {
    try {
      await crearGasto.mutateAsync(data)
      toast.success('Gasto registrado')
      setModal(null)
    } catch (e) { toast.error(errMsg(e, 'No se pudo registrar el gasto')) }
  }

  const handleCrearCategoria = async (data) => {
    try {
      await crearCategoria.mutateAsync(data)
      toast.success('Categoría agregada')
      setModal(null)
    } catch (e) { toast.error(errMsg(e, 'No se pudo agregar la categoría')) }
  }

  const handleEliminar = async (g) => {
    try {
      await eliminarGasto.mutateAsync(g.id_gasto)
      toast.success('Gasto eliminado')
    } catch (e) { toast.error(errMsg(e, 'No se pudo eliminar el gasto')) }
  }

  const inputCls = 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gastos operativos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Costos de operar el negocio y utilidad neta</p>
        </div>
        {tab === 'libro' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setModal('categoria')}>+ Categoría</Button>
            <Button onClick={() => setModal('gasto')}>+ Registrar gasto</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[['libro', 'Libro de gastos'], ['resultados', 'Estado de resultados']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* LIBRO DE GASTOS */}
      {tab === 'libro' && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
                <input type="date" value={filtros.fecha_inicio} className={inputCls}
                  onChange={(e) => setFiltros((f) => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
                <input type="date" value={filtros.fecha_fin} className={inputCls}
                  onChange={(e) => setFiltros((f) => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Categoría</label>
                <select value={filtros.categoria} className={inputCls}
                  onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}>
                  <option value="">Todas</option>
                  {cats.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total del filtro</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalGastos)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            {gastos.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">No hay gastos en el rango seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-2.5">Fecha</th>
                      <th className="px-4 py-2.5">Categoría</th>
                      <th className="px-4 py-2.5">Descripción</th>
                      <th className="px-4 py-2.5">Método</th>
                      <th className="px-4 py-2.5 text-right">Monto</th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {gastos.map((g) => (
                      <tr key={g.id_gasto} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{fmtFecha(g.fecha)}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{g.categoria_nombre}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{g.descripcion || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{g.metodo_pago_display}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">−{formatCurrency(g.monto)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleEliminar(g)} disabled={eliminarGasto.isPending}
                            className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            title="Eliminar gasto">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ESTADO DE RESULTADOS */}
      {tab === 'resultados' && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
                <input type="date" value={rango.fecha_inicio} className={inputCls}
                  onChange={(e) => setRango((r) => ({ ...r, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
                <input type="date" value={rango.fecha_fin} className={inputCls}
                  onChange={(e) => setRango((r) => ({ ...r, fecha_fin: e.target.value }))} />
              </div>
            </div>
          </Card>

          {estado && (
            <Card className="p-6 space-y-3">
              <Fila label="Ingresos (ventas)" valor={estado.ingresos} />
              <Fila label="− Costo de ventas" valor={-estado.costo_ventas} />
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <Fila label="= Utilidad bruta" valor={estado.utilidad_bruta} bold />
              </div>

              {estado.gastos_por_categoria?.length > 0 && (
                <div className="pl-4 space-y-1 pt-2">
                  {estado.gastos_por_categoria.map((g) => (
                    <Fila key={g.categoria} label={`− ${g.categoria}`} valor={-g.total} small />
                  ))}
                </div>
              )}
              <Fila label="− Gastos operativos (total)" valor={-estado.gastos_total} />

              <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-3">
                <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  estado.utilidad_neta >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <span className="font-bold text-gray-900 dark:text-white">Utilidad neta</span>
                  <span className={`text-2xl font-bold ${
                    estado.utilidad_neta >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                  }`}>{formatCurrency(estado.utilidad_neta)}</span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <Modal isOpen={modal === 'gasto'} onClose={() => setModal(null)} title="Registrar gasto" size="lg">
        <GastoForm categorias={cats} cajaAbierta={cajaAbierta} onSubmit={handleCrearGasto}
          onCancel={() => setModal(null)} isLoading={crearGasto.isPending} />
      </Modal>
      <Modal isOpen={modal === 'categoria'} onClose={() => setModal(null)} title="Nueva categoría de gasto">
        <CategoriaGastoForm onSubmit={handleCrearCategoria} onCancel={() => setModal(null)} isLoading={crearCategoria.isPending} />
      </Modal>
    </div>
  )
}

const Fila = ({ label, valor, bold, small }) => (
  <div className={`flex items-center justify-between ${small ? 'text-sm text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
    <span className={bold ? 'font-semibold text-gray-900 dark:text-white' : ''}>{label}</span>
    <span className={`${bold ? 'font-bold text-gray-900 dark:text-white' : 'font-medium'} tabular-nums`}>
      {new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(valor || 0)}
    </span>
  </div>
)

export default Gastos
