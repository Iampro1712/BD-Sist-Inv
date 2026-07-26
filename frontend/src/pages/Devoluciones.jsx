import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import {
  useDevoluciones, useDevolucion, useCreateDevolucion,
  useDevolucionesCompra, useCreateDevolucionCompra,
} from '../hooks/useDevoluciones'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../hooks/useAuthStore'
import { Button, Card, Modal } from '../components/ui'
import DevolucionForm from '../components/forms/DevolucionForm'
import DevolucionCompraForm from '../components/forms/DevolucionCompraForm'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)
const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

/** Saca el mensaje del backend, que explica el motivo real del rechazo. */
const mensajeError = (err, fallback) => {
  const data = err?.response?.data
  const details = data?.error?.details
  if (details && typeof details === 'object') {
    const primero = Object.values(details)[0]
    if (primero) return Array.isArray(primero) ? primero[0] : primero
  }
  const message = data?.error?.message
  if (typeof message === 'string') return message
  if (typeof data?.error === 'string') return data.error
  return data?.detalles?.[0] || err?.message || fallback
}

const Devoluciones = () => {
  const [tab, setTab] = useState('clientes')
  const [page, setPage] = useState(1)
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [isNewCompraOpen, setIsNewCompraOpen] = useState(false)
  const [isDetalleOpen, setIsDetalleOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const toast = useToast()
  const esAdmin = useAuthStore((s) => s.user?.is_staff)

  const { data, isLoading, error } = useDevoluciones({ page })
  const { data: detalle } = useDevolucion(selectedId)
  const createMutation = useCreateDevolucion()

  // Devoluciones a proveedor: solo admin (el backend las restringe así).
  const { data: dataCompra, isLoading: cargandoCompra, error: errorCompra } =
    useDevolucionesCompra({}, tab === 'proveedores' && esAdmin)
  const createCompra = useCreateDevolucionCompra()

  const devoluciones = data?.results || data || []
  const totalCount = data?.count || devoluciones.length
  const totalPages = totalCount ? Math.ceil(totalCount / 20) : 1

  const devolucionesCompra = dataCompra?.results || dataCompra || []

  const handleCreate = async (formData) => {
    try {
      await createMutation.mutateAsync(formData)
      setIsNewOpen(false)
      toast.success('Devolución procesada y stock reingresado')
    } catch (err) {
      toast.error(mensajeError(err, 'Error al procesar devolución'))
    }
  }

  const handleCreateCompra = async (formData) => {
    try {
      const res = await createCompra.mutateAsync(formData)
      const d = res.data
      const aFavor = d.saldo_a_favor
      setIsNewCompraOpen(false)
      toast.success(aFavor > 0
        ? `Devolución registrada. El proveedor queda debiendo ${formatCurrency(aFavor)}`
        : 'Devolución registrada: stock descontado y deuda ajustada')
    } catch (err) {
      toast.error(mensajeError(err, 'Error al registrar la devolución'))
    }
  }

  const openDetalle = (id) => { setSelectedId(id); setIsDetalleOpen(true) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devoluciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tab === 'clientes'
              ? 'Notas de crédito; al procesarlas el stock se reingresa'
              : 'Mercadería devuelta al proveedor: sale del stock y baja la deuda'}
          </p>
        </div>
        {tab === 'clientes' ? (
          <Button onClick={() => setIsNewOpen(true)} className="shrink-0">+ Nueva devolución</Button>
        ) : esAdmin && (
          <Button onClick={() => setIsNewCompraOpen(true)} className="shrink-0">
            + Devolver a proveedor
          </Button>
        )}
      </div>

      {/* Pestañas: las dos devoluciones viven en tablas distintas porque mueven
          el stock en direcciones opuestas, pero se administran en un solo lugar. */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'clientes', label: 'De clientes' },
          { id: 'proveedores', label: 'A proveedores' },
        ].map((t) => (
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

      {/* ---------------------------- A PROVEEDORES ---------------------------- */}
      {tab === 'proveedores' && (
        !esAdmin ? (
          <Card className="p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Solo para administradores
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Devolver mercadería a un proveedor mueve stock y deuda.
            </p>
          </Card>
        ) : errorCompra ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
            Error al cargar devoluciones a proveedores: {errorCompra.message}
          </div>
        ) : cargandoCompra ? (
          <Card className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </Card>
        ) : devolucionesCompra.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sin devoluciones a proveedores
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Cuando llegue mercadería defectuosa o equivocada, registrala acá para
              que salga del inventario y deje de deberse.
            </p>
            <Button className="mt-4" onClick={() => setIsNewCompraOpen(true)}>
              + Devolver a proveedor
            </Button>
          </Card>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"># Dev.</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proveedor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Compra</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motivo</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Devuelto</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reembolsado</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">A favor</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {devolucionesCompra.map((d) => (
                    <motion.tr key={d.id_devolucion_compra} variants={fadeIn}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          #{d.id_devolucion_compra}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {d.proveedor_nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        #{d.id_orden}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(d.fecha)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[220px] truncate">
                        {d.motivo || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(d.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                        {d.reembolso > 0 ? (
                          <>
                            {formatCurrency(d.reembolso)}
                            <span className="block text-xs text-gray-400">
                              {d.metodo_reembolso_display}
                            </span>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {d.saldo_a_favor > 0 ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {formatCurrency(d.saldo_a_favor)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )
      )}

      {tab === 'clientes' && error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar devoluciones: {error.message}
        </div>
      )}

      {tab === 'clientes' && (isLoading ? (
        <Card className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
        </Card>
      ) : devoluciones.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No hay devoluciones</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Registra una devolución para reingresar productos al inventario.</p>
          <Button className="mt-4" onClick={() => setIsNewOpen(true)}>+ Nueva devolución</Button>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"># Dev.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Venta</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {devoluciones.map((d) => (
                  <motion.tr key={d.id_devolucion} variants={fadeIn} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">#{d.id_devolucion}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{d.cliente_nombre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{d.id_venta ? `#${d.id_venta}` : '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(d.fecha)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600 dark:text-red-400">−{formatCurrency(d.total)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => openDetalle(d.id_devolucion)}
                        className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">Ver detalle</button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="bg-gray-50 dark:bg-gray-900/30 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40">← Anterior</button>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40">Siguiente →</button>
              </div>
            </div>
          )}
        </motion.div>
      ))}

      {/* Modal Nueva (cliente) */}
      <Modal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} title="Nueva Devolución" size="xl">
        <DevolucionForm onSubmit={handleCreate} onCancel={() => setIsNewOpen(false)} isLoading={createMutation.isPending} />
      </Modal>

      {/* Modal Nueva (proveedor) */}
      <Modal isOpen={isNewCompraOpen} onClose={() => setIsNewCompraOpen(false)}
        title="Devolver mercadería a un proveedor" size="xl">
        <DevolucionCompraForm onSubmit={handleCreateCompra}
          onCancel={() => setIsNewCompraOpen(false)} isLoading={createCompra.isPending} />
      </Modal>

      {/* Modal Detalle */}
      <Modal isOpen={isDetalleOpen} onClose={() => setIsDetalleOpen(false)} title="Detalle de Devolución" size="lg">
        {detalle && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">#{detalle.id_devolucion}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {detalle.cliente_nombre} · {formatDate(detalle.fecha)}
                  {detalle.id_venta ? ` · Venta #${detalle.id_venta}` : ''}
                </p>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {detalle.estado_display || detalle.estado}
              </span>
            </div>

            {detalle.motivo && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Motivo</p>
                <p className="text-sm text-amber-800 dark:text-amber-300">{detalle.motivo}</p>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-16">Cant.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Precio</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {(detalle.productos || []).map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{p.nombre}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{p.cantidad}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatCurrency(p.precio_unitario)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(p.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-900 dark:bg-gray-700">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-300">Total nota de crédito</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-white">{formatCurrency(detalle.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Devoluciones
