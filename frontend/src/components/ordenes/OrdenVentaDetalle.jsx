import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fadeIn } from '../../utils/animations'
import { useRegistrarPago, useEliminarPago } from '../../hooks/useOrdenesVenta'
import { useCajaActual } from '../../hooks/useCaja'
import { useToast } from '../../hooks/useToast'
import { Button, Modal, ConfirmDialog } from '../ui'
import PagoForm from '../forms/PagoForm'
import { generarReciboVentaPDF, generarReciboPagoPDF } from '../../utils/exportReportes'

// Extrae el primer mensaje de error legible de la respuesta del backend
// (custom_exception_handler anida los detalles en error.details.<campo>,
// como string o como array según el validador que lo haya lanzado).
const extraerMensajeError = (err, fallback) => {
  const details = err.response?.data?.error?.details
  if (details && typeof details === 'object') {
    const primero = Object.values(details)[0]
    if (primero) return Array.isArray(primero) ? primero[0] : primero
  }
  const message = err.response?.data?.error?.message
  if (typeof message === 'string') return message
  return fallback
}

const OrdenVentaDetalle = ({ orden }) => {
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false)
  const [pagoToDelete, setPagoToDelete] = useState(null)
  const toast = useToast()

  const registrarPagoMutation = useRegistrarPago()
  const eliminarPagoMutation = useEliminarPago()
  const { data: cajaActual } = useCajaActual()
  const cajaAbierta = !!cajaActual

  const pagos = orden.pagos || []
  const montoPagado = orden.monto_pagado || 0
  const saldoPendiente = orden.saldo_pendiente ?? orden.total ?? 0

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleRegistrarPago = async (data) => {
    try {
      await registrarPagoMutation.mutateAsync({ idVenta: orden.id_venta, data })
      setIsPagoModalOpen(false)
      toast.success('Pago registrado exitosamente')
    } catch (err) {
      toast.error(extraerMensajeError(err, 'Error al registrar el pago'))
    }
  }

  const handleConfirmarEliminar = async () => {
    if (!pagoToDelete) return
    try {
      await eliminarPagoMutation.mutateAsync({ idVenta: orden.id_venta, idPago: pagoToDelete.id_pago })
      toast.success('Pago eliminado exitosamente')
      setPagoToDelete(null)
    } catch (err) {
      toast.error(extraerMensajeError(err, 'Error al eliminar el pago'))
      setPagoToDelete(null)
    }
  }

  const totalItems = orden.productos?.reduce((s, p) => s + (p.cantidad || 1), 0) || 0
  const subtotal   = orden.productos?.reduce((s, p) => s + (p.subtotal || 0), 0) || 0
  const descuento  = subtotal - (orden.total || 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <motion.div variants={fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">
            Orden de Venta
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">#{orden.id_venta}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
            {formatDate(orden.fecha)}
          </p>
        </div>
        <button
          onClick={() => generarReciboVentaPDF(orden)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Descargar recibo de venta en PDF"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Recibo PDF
        </button>
      </motion.div>

      {/* Cliente */}
      <motion.div variants={fadeIn} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
            {(orden.cliente_nombre || '?')[0].toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Cliente</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{orden.cliente_nombre}</p>
        </div>
      </motion.div>

      {/* Productos */}
      <motion.div variants={fadeIn}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Productos
          </p>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {totalItems} unidad{totalItems !== 1 ? 'es' : ''}
          </span>
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
                      {producto.cantidad}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(producto.precio_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(producto.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No hay productos en esta venta
          </div>
        )}
      </motion.div>

      {/* Totales */}
      <motion.div variants={fadeIn} className="space-y-1">
        {descuento > 0 && (
          <div className="flex items-center justify-between px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        )}
        {descuento > 0 && (
          <div className="flex items-center justify-between px-4 py-2 text-sm text-green-600 dark:text-green-400">
            <span>Descuento aplicado</span>
            <span>−{formatCurrency(descuento)}</span>
          </div>
        )}
        <div className="bg-gray-900 dark:bg-gray-700 rounded-xl px-5 py-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Total de la venta</span>
          <span className="text-2xl font-bold text-white">{formatCurrency(orden.total)}</span>
        </div>
      </motion.div>

      {/* Estado de pago */}
      <motion.div variants={fadeIn} className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Estado de pago
          </p>
          {orden.estado_pago !== 'pagado' && (
            <Button
              size="sm"
              onClick={() => setIsPagoModalOpen(true)}
              disabled={!cajaAbierta}
              title={!cajaAbierta ? 'Abre la caja para registrar pagos' : undefined}
            >
              + Registrar pago
            </Button>
          )}
        </div>

        {/* Aviso: sin caja abierta no se pueden registrar pagos */}
        {orden.estado_pago !== 'pagado' && !cajaAbierta && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
            No hay caja abierta.{' '}
            <Link to="/caja" className="font-medium underline">Abre la caja</Link> para poder registrar pagos.
          </div>
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
          <div className={`rounded-lg border p-3 ${
            saldoPendiente > 0
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
          }`}>
            <p className={`text-xs mb-1 ${saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
              Saldo pendiente
            </p>
            <p className={`text-lg font-bold ${saldoPendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>
              {formatCurrency(saldoPendiente)}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            orden.estado_pago === 'pagado'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : orden.estado_pago === 'parcial'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            {orden.estado_pago === 'pagado' ? '✓ Pagado completo' :
             orden.estado_pago === 'parcial' ? '◐ Pago parcial' : '○ Pendiente de pago'}
          </span>
        </div>
      </motion.div>

      {/* Historial de pagos */}
      {pagos.length > 0 && (
        <motion.div variants={fadeIn}>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Historial de pagos ({pagos.length})
          </p>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Método</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Referencia</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {pagos.map((pago, i) => (
                  <tr key={pago.id_pago} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(pago.fecha_pago).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{pago.metodo_pago_display}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(pago.monto)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 font-mono">{pago.referencia || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => generarReciboPagoPDF(orden, pago)}
                          className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          title="Descargar comprobante de pago"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        {i === 0 && (
                          <button
                            onClick={() => setPagoToDelete(pago)}
                            disabled={eliminarPagoMutation.isPending}
                            className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Eliminar pago"
                          >
                            {eliminarPagoMutation.isPending && pagoToDelete?.id_pago === pago.id_pago ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Modal registrar pago */}
      <Modal
        isOpen={isPagoModalOpen}
        onClose={() => setIsPagoModalOpen(false)}
        title="Registrar Pago"
        size="md"
      >
        <PagoForm
          orden={orden}
          onSubmit={handleRegistrarPago}
          onCancel={() => setIsPagoModalOpen(false)}
          isLoading={registrarPagoMutation.isPending}
        />
      </Modal>

      {/* Confirmación eliminar pago */}
      <ConfirmDialog
        isOpen={!!pagoToDelete}
        onClose={() => setPagoToDelete(null)}
        onConfirm={handleConfirmarEliminar}
        closeOnConfirm={false}
        loading={eliminarPagoMutation.isPending}
        title="Eliminar pago"
        message={pagoToDelete
          ? `¿Estás seguro de eliminar el pago de ${formatCurrency(pagoToDelete.monto)}? Esta acción no se puede deshacer.`
          : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

    </div>
  )
}

export default OrdenVentaDetalle
