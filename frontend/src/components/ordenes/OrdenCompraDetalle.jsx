import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, Modal } from '../ui'
import ProveedorLogo from '../ui/ProveedorLogo'
import PagoForm from '../forms/PagoForm'
import { fadeIn } from '../../utils/animations'
import { useRegistrarPagoCompra } from '../../hooks/useOrdenesCompra'
import { useCajaActual } from '../../hooks/useCaja'
import { useToast } from '../../hooks/useToast'

// Extrae el primer mensaje legible del formato de error del backend.
const extraerMensajeError = (err, fallback) => {
  const details = err.response?.data?.error?.details
  if (details && typeof details === 'object') {
    const primero = Object.values(details)[0]
    if (primero) return Array.isArray(primero) ? primero[0] : primero
  }
  const message = err.response?.data?.error?.message
  return typeof message === 'string' ? message : fallback
}

const pagoBadge = {
  pagado: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: '✓ Pagado completo' },
  parcial: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: '◐ Pago parcial' },
  pendiente: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: '○ Pendiente de pago' },
}

const estadoConfig = {
  pendiente: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-400', label: 'Pendiente' },
  recibida:  { bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500',  label: 'Recibida' },
  cancelada: { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500',    label: 'Cancelada' },
}

const OrdenCompraDetalle = ({ orden, onConfirmar, onRecibir, onCancelar, isLoading = false }) => {
  const [showCancelarInput, setShowCancelarInput] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [motivoError, setMotivoError] = useState('')
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false)
  const toast = useToast()
  const registrarPago = useRegistrarPagoCompra()
  const { data: cajaActual } = useCajaActual()
  const cajaAbierta = !!cajaActual

  const montoPagado = orden.monto_pagado || 0
  const saldoPendiente = orden.saldo_pendiente ?? orden.total ?? 0
  const saldoAFavor = orden.saldo_a_favor ?? 0
  const totalDevuelto = orden.total_devuelto ?? 0
  const pcfg = pagoBadge[orden.estado_pago] || pagoBadge.pendiente

  const handleRegistrarPago = async (data) => {
    try {
      await registrarPago.mutateAsync({ idOrden: orden.id_orden, data })
      setIsPagoModalOpen(false)
      toast.success('Pago registrado exitosamente')
    } catch (err) {
      toast.error(extraerMensajeError(err, 'Error al registrar el pago'))
    }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const cfg = estadoConfig[orden.estado] || estadoConfig.pendiente

  const handleCancelarSubmit = () => {
    if (!motivoCancelacion.trim()) {
      setMotivoError('El motivo de cancelación es requerido')
      return
    }
    onCancelar(motivoCancelacion)
    setShowCancelarInput(false)
    setMotivoCancelacion('')
    setMotivoError('')
  }

  const totalItems = orden.productos?.reduce((s, p) => s + (p.cantidad || 1), 0) || 0

  return (
    <div className="space-y-5">

      {/* Header — número + estado */}
      <motion.div variants={fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">
            Orden de Compra
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">#{orden.id_orden}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
            {formatDate(orden.fecha_creacion)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </motion.div>

      {/* Proveedor */}
      <motion.div variants={fadeIn} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <ProveedorLogo nombreEmpresa={orden.proveedor_nombre} size="small" />
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Proveedor</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{orden.proveedor_nombre}</p>
          {orden.proveedor_contacto && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{orden.proveedor_contacto}</p>
          )}
        </div>
      </motion.div>

      {/* Productos */}
      <motion.div variants={fadeIn}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Productos
          </p>
          <span className="text-xs text-gray-400 dark:text-gray-500">{totalItems} unidad{totalItems !== 1 ? 'es' : ''}</span>
        </div>

        {orden.productos && orden.productos.length > 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-20">Cant.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-32">Precio unit.</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-32">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {orden.productos.map((producto, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{producto.nombre}</p>
                      {producto.sku && (
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{producto.sku}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {producto.cantidad || 1}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(producto.precio_compra)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency((producto.cantidad || 1) * producto.precio_compra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No hay productos en esta orden
          </div>
        )}
      </motion.div>

      {/* Total */}
      <motion.div variants={fadeIn} className="bg-gray-900 dark:bg-gray-700 rounded-xl px-5 py-4 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">Total de la orden</span>
        <span className="text-2xl font-bold text-white">{formatCurrency(orden.total)}</span>
      </motion.div>

      {/* Estado de pago al proveedor (cuentas por pagar) — no aplica si cancelada */}
      {orden.estado !== 'cancelada' && orden.total > 0 && (
        <motion.div variants={fadeIn} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pago al proveedor
            </p>
            {orden.estado_pago !== 'pagado' && (
              <Button size="sm" onClick={() => setIsPagoModalOpen(true)}>
                + Registrar pago
              </Button>
            )}
          </div>

          {orden.estado_pago !== 'pagado' && !cajaAbierta && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Para pagar en efectivo necesitas una <Link to="/caja" className="underline font-medium">caja abierta</Link>. Por transferencia/cheque no hace falta.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(orden.total)}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1">Pagado</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(montoPagado)}</p>
            </div>
            {/* Un saldo negativo no es una deuda: es plata que el proveedor
                debe por mercadería devuelta y no reembolsada. */}
            {saldoAFavor > 0 ? (
              <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <p className="text-xs mb-1 text-blue-600 dark:text-blue-400">Te debe</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(saldoAFavor)}
                </p>
              </div>
            ) : (
              <div className={`rounded-lg border p-3 ${saldoPendiente > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'}`}>
                <p className={`text-xs mb-1 ${saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>Saldo por pagar</p>
                <p className={`text-lg font-bold ${saldoPendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>{formatCurrency(saldoPendiente)}</p>
              </div>
            )}
          </div>

          {totalDevuelto > 0 && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Se devolvieron {formatCurrency(totalDevuelto)} de mercadería a este
              proveedor, y ya no se deben.
            </p>
          )}

          <div className="flex justify-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${pcfg.bg} ${pcfg.text}`}>
              {pcfg.label}
            </span>
          </div>
        </motion.div>
      )}

      {/* Notas */}
      {orden.notas && (
        <motion.div variants={fadeIn} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex gap-3">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Notas</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{orden.notas}</p>
          </div>
        </motion.div>
      )}

      {orden.estado === 'pendiente' && orden.puede_recibirse === false && (
        <motion.div variants={fadeIn}
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
          El detalle de esta orden no tiene cantidades registradas, así que no se
          puede saber cuánto stock sumar al recibirla. Es una orden creada antes de
          que el sistema guardara las cantidades por línea.
        </motion.div>
      )}

      {/* Flujo de acciones */}
      {!showCancelarInput ? (
        <motion.div variants={fadeIn} className="flex flex-wrap justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">

          {orden.estado === 'pendiente' && (
            <>
              <button
                onClick={() => setShowCancelarInput(true)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
              >
                Cancelar orden
              </button>
              {/* Llama a `recibir`, que es lo que suma el stock. Antes este mismo
                  botón llamaba a `confirmar`, que solo cambiaba el estado. */}
              <Button onClick={onRecibir} loading={isLoading}
                disabled={isLoading || orden.puede_recibirse === false}>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Recibir y sumar al inventario
              </Button>
            </>
          )}

          {orden.estado === 'recibida' && (
            orden.stock_aplicado ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Orden completada — stock sumado al inventario
              </div>
            ) : (
              // Las órdenes recibidas antes de este arreglo nunca movieron
              // inventario; decir "stock actualizado" sería falso.
              <div className="text-sm text-amber-600 dark:text-amber-400 text-right">
                Orden completada. El stock de esta orden no quedó registrado en
                el inventario (se recibió antes de que el sistema lo hiciera).
              </div>
            )
          )}

          {orden.estado === 'cancelada' && (
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm font-medium">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              Orden cancelada
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3"
        >
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ¿Por qué se cancela esta orden?
          </p>
          <textarea
            value={motivoCancelacion}
            onChange={(e) => { setMotivoCancelacion(e.target.value); setMotivoError('') }}
            rows={3}
            placeholder="Escribe el motivo de cancelación..."
            className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none ${
              motivoError ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {motivoError && <p className="text-xs text-red-500">{motivoError}</p>}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowCancelarInput(false); setMotivoCancelacion(''); setMotivoError('') }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleCancelarSubmit}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-40"
            >
              Confirmar cancelación
            </button>
          </div>
        </motion.div>
      )}

      {/* Modal registrar pago a proveedor */}
      <Modal isOpen={isPagoModalOpen} onClose={() => setIsPagoModalOpen(false)} title="Registrar pago a proveedor" size="md">
        <PagoForm
          orden={orden}
          onSubmit={handleRegistrarPago}
          onCancel={() => setIsPagoModalOpen(false)}
          isLoading={registrarPago.isPending}
        />
      </Modal>

    </div>
  )
}

export default OrdenCompraDetalle
