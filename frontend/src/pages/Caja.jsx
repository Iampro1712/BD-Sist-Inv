import { useState } from 'react'
import { Button, Card, Modal } from '../components/ui'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../hooks/useAuthStore'
import {
  useCajaActual, useHistorialCaja, useAbrirCaja, useCerrarCaja, useCrearMovimiento,
} from '../hooks/useCaja'
import AbrirCajaForm from '../components/forms/AbrirCajaForm'
import CerrarCajaForm from '../components/forms/CerrarCajaForm'
import MovimientoCajaForm from '../components/forms/MovimientoCajaForm'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const fmtFecha = (s) => (s ? new Date(s).toLocaleString('es-NI') : '—')

const Caja = () => {
  const toast = useToast()
  const isAdmin = useAuthStore((s) => !!s.user?.is_staff)

  const { data: sesion, isLoading } = useCajaActual()
  const { data: historial } = useHistorialCaja()
  const abrir = useAbrirCaja()
  const cerrar = useCerrarCaja()
  const movimiento = useCrearMovimiento()

  const [modal, setModal] = useState(null) // 'abrir' | 'cerrar' | 'movimiento' | null

  const errMsg = (e, fallback) =>
    e?.response?.data?.error?.message ||
    e?.response?.data?.error ||
    e?.response?.data?.caja ||
    fallback

  const handleAbrir = async (data) => {
    try {
      await abrir.mutateAsync(data)
      toast.success('Caja abierta')
      setModal(null)
    } catch (e) { toast.error(errMsg(e, 'No se pudo abrir la caja')) }
  }

  const handleCerrar = async (data) => {
    try {
      const res = await cerrar.mutateAsync({ id: sesion.id_sesion, data })
      const dif = parseFloat(res.data.diferencia)
      toast.success(dif === 0 ? 'Caja cerrada y cuadrada' : `Caja cerrada · diferencia ${formatCurrency(dif)}`)
      setModal(null)
    } catch (e) { toast.error(errMsg(e, 'No se pudo cerrar la caja')) }
  }

  const handleMovimiento = async (data) => {
    try {
      await movimiento.mutateAsync({ id: sesion.id_sesion, data })
      toast.success('Movimiento registrado')
      setModal(null)
    } catch (e) { toast.error(errMsg(e, 'No se pudo registrar el movimiento')) }
  }

  const totales = sesion?.totales
  const historialList = Array.isArray(historial) ? historial : (historial?.results || [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Apertura, cierre y arqueo del turno</p>
        </div>
        {!isLoading && !sesion && (
          <Button onClick={() => setModal('abrir')}>Abrir caja</Button>
        )}
      </div>

      {/* Sin caja abierta */}
      {!isLoading && !sesion && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No hay una caja abierta.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Abre la caja para poder cobrar en el punto de venta.
          </p>
        </Card>
      )}

      {/* Caja abierta */}
      {sesion && (
        <>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Caja abierta
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Por {sesion.usuario_nombre} · desde {fmtFecha(sesion.fecha_apertura)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setModal('movimiento')}>Retiro / Ingreso</Button>
                <Button onClick={() => setModal('cerrar')}>Cerrar caja</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fondo de apertura</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(sesion.monto_apertura)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ventas en efectivo</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(totales?.pagos_por_metodo?.efectivo)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Retiros</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  −{formatCurrency(totales?.retiros_manuales)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Efectivo esperado</p>
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  {formatCurrency(sesion.esperado_actual)}
                </p>
              </div>
            </div>

            {/* Otros métodos (no afectan el cajón) */}
            {totales?.pagos_por_metodo && Object.keys(totales.pagos_por_metodo).some((m) => m !== 'efectivo') && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                Otros cobros (no cuentan para el arqueo):{' '}
                {Object.entries(totales.pagos_por_metodo)
                  .filter(([m]) => m !== 'efectivo')
                  .map(([m, v]) => `${m}: ${formatCurrency(v)}`)
                  .join(' · ')}
              </p>
            )}
          </Card>

          {/* Movimientos del turno */}
          {sesion.movimientos?.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Movimientos del turno</h2>
              <div className="space-y-2">
                {sesion.movimientos.map((m) => (
                  <div key={m.id_movimiento} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">
                      {m.tipo === 'retiro' ? '↓' : '↑'} {m.motivo}
                    </span>
                    <span className={m.tipo === 'retiro' ? 'text-red-500' : 'text-green-500'}>
                      {m.tipo === 'retiro' ? '−' : '+'}{formatCurrency(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Historial (solo admin) */}
      {isAdmin && historialList.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Historial de turnos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Apertura</th>
                  <th className="py-2 pr-4">Cierre</th>
                  <th className="py-2 pr-4">Usuario</th>
                  <th className="py-2 pr-4 text-right">Esperado</th>
                  <th className="py-2 pr-4 text-right">Contado</th>
                  <th className="py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {historialList.map((s) => (
                  <tr key={s.id_sesion} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{fmtFecha(s.fecha_apertura)}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{fmtFecha(s.fecha_cierre)}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{s.usuario_nombre}</td>
                    <td className="py-2 pr-4 text-right text-gray-600 dark:text-gray-300">
                      {s.monto_esperado != null ? formatCurrency(s.monto_esperado) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-600 dark:text-gray-300">
                      {s.monto_cierre_contado != null ? formatCurrency(s.monto_cierre_contado) : '—'}
                    </td>
                    <td className={`py-2 text-right font-medium ${
                      s.diferencia == null ? 'text-gray-400'
                        : parseFloat(s.diferencia) === 0 ? 'text-green-600 dark:text-green-400'
                        : parseFloat(s.diferencia) > 0 ? 'text-blue-600 dark:text-blue-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {s.diferencia != null ? formatCurrency(s.diferencia) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={modal === 'abrir'} onClose={() => setModal(null)} title="Abrir caja">
        <AbrirCajaForm onSubmit={handleAbrir} onCancel={() => setModal(null)} isLoading={abrir.isPending} />
      </Modal>
      <Modal isOpen={modal === 'cerrar'} onClose={() => setModal(null)} title="Cerrar caja">
        <CerrarCajaForm sesion={sesion} onSubmit={handleCerrar} onCancel={() => setModal(null)} isLoading={cerrar.isPending} />
      </Modal>
      <Modal isOpen={modal === 'movimiento'} onClose={() => setModal(null)} title="Movimiento de caja">
        <MovimientoCajaForm onSubmit={handleMovimiento} onCancel={() => setModal(null)} isLoading={movimiento.isPending} />
      </Modal>
    </div>
  )
}

export default Caja
