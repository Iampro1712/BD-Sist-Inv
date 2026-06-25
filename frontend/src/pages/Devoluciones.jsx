import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { useDevoluciones, useDevolucion, useCreateDevolucion } from '../hooks/useDevoluciones'
import { useToast } from '../hooks/useToast'
import { Button, Card, Modal } from '../components/ui'
import DevolucionForm from '../components/forms/DevolucionForm'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)
const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

const Devoluciones = () => {
  const [page, setPage] = useState(1)
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [isDetalleOpen, setIsDetalleOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const toast = useToast()

  const { data, isLoading, error } = useDevoluciones({ page })
  const { data: detalle } = useDevolucion(selectedId)
  const createMutation = useCreateDevolucion()

  const devoluciones = data?.results || data || []
  const totalCount = data?.count || devoluciones.length
  const totalPages = totalCount ? Math.ceil(totalCount / 20) : 1

  const handleCreate = async (formData) => {
    try {
      await createMutation.mutateAsync(formData)
      setIsNewOpen(false)
      toast.success('Devolución procesada y stock reingresado')
    } catch (err) {
      toast.error(err.response?.data?.detalles?.[0] || err.response?.data?.error || err.message || 'Error al procesar devolución')
    }
  }

  const openDetalle = (id) => { setSelectedId(id); setIsDetalleOpen(true) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devoluciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Notas de crédito; al procesarlas el stock se reingresa</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="shrink-0">+ Nueva devolución</Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar devoluciones: {error.message}
        </div>
      )}

      {isLoading ? (
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
      )}

      {/* Modal Nueva */}
      <Modal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} title="Nueva Devolución" size="xl">
        <DevolucionForm onSubmit={handleCreate} onCancel={() => setIsNewOpen(false)} isLoading={createMutation.isPending} />
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
