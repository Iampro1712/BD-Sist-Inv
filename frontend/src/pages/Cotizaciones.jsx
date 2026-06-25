import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import {
  useCotizaciones, useCotizacion, useCreateCotizacion,
  useConvertirCotizacion, useCambiarEstadoCotizacion,
} from '../hooks/useCotizaciones'
import { useToast } from '../hooks/useToast'
import { Button, Card, Modal, ConfirmDialog } from '../components/ui'
import CotizacionForm from '../components/forms/CotizacionForm'
import { generarCotizacionPDF } from '../utils/exportReportes'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)
const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

const estadoBadge = (estado) => ({
  pendiente:  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  aprobada:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  rechazada:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  convertida: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
}[estado] || 'bg-gray-100 text-gray-600')

const Cotizaciones = () => {
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [page, setPage] = useState(1)
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [isDetalleOpen, setIsDetalleOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [convertId, setConvertId] = useState(null)
  const toast = useToast()

  const { data, isLoading, error } = useCotizaciones({ estado: estadoFiltro || undefined, page })
  const { data: detalle } = useCotizacion(selectedId)
  const createMutation = useCreateCotizacion()
  const convertirMutation = useConvertirCotizacion()
  const cambiarEstadoMutation = useCambiarEstadoCotizacion()

  const cotizaciones = data?.results || data || []
  const totalCount = data?.count || cotizaciones.length
  const totalPages = totalCount ? Math.ceil(totalCount / 20) : 1

  const handleCreate = async (formData) => {
    try {
      await createMutation.mutateAsync(formData)
      setIsNewOpen(false)
      toast.success('Cotización creada')
    } catch (err) {
      toast.error(err.response?.data?.detalles?.[0] || err.message || 'Error al crear cotización')
    }
  }

  const handleConvertir = async () => {
    try {
      const res = await convertirMutation.mutateAsync(convertId)
      toast.success(`Convertida en venta #${res.data.id_venta}`)
      setConvertId(null)
      setIsDetalleOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al convertir')
      setConvertId(null)
    }
  }

  const handleCambiarEstado = async (estado) => {
    try {
      await cambiarEstadoMutation.mutateAsync({ id: selectedId, estado })
      toast.success('Estado actualizado')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cambiar estado')
    }
  }

  const openDetalle = (id) => { setSelectedId(id); setIsDetalleOpen(true) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cotizaciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Proformas para clientes; conviértelas en venta con un clic</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)} className="shrink-0">+ Nueva cotización</Button>
      </div>

      {/* Filtro */}
      <div className="flex gap-2">
        <select value={estadoFiltro} onChange={(e) => { setEstadoFiltro(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
          <option value="convertida">Convertida</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar cotizaciones: {error.message}
        </div>
      )}

      {/* Tabla */}
      {isLoading ? (
        <Card className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
        </Card>
      ) : cotizaciones.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No hay cotizaciones</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Crea una proforma para tu cliente.</p>
          <Button className="mt-4" onClick={() => setIsNewOpen(true)}>+ Nueva cotización</Button>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"># Cot.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {cotizaciones.map((c) => (
                  <motion.tr key={c.id_cotizacion} variants={fadeIn} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">#{c.id_cotizacion}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.cliente_nombre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(c.fecha)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoBadge(c.estado)}`}>
                        {c.estado_display || c.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(c.total)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => openDetalle(c.id_cotizacion)}
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
      <Modal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} title="Nueva Cotización" size="xl">
        <CotizacionForm onSubmit={handleCreate} onCancel={() => setIsNewOpen(false)} isLoading={createMutation.isPending} />
      </Modal>

      {/* Modal Detalle */}
      <Modal isOpen={isDetalleOpen} onClose={() => setIsDetalleOpen(false)} title="Detalle de Cotización" size="lg">
        {detalle && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">#{detalle.id_cotizacion}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{detalle.cliente_nombre} · {formatDate(detalle.fecha)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Válida por {detalle.validez_dias} día(s)</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${estadoBadge(detalle.estado)}`}>
                {detalle.estado_display || detalle.estado}
              </span>
            </div>

            {/* Productos */}
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
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-300">Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-white">{formatCurrency(detalle.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {detalle.id_venta && (
              <p className="text-sm text-green-600 dark:text-green-400">✓ Convertida en venta #{detalle.id_venta}</p>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => generarCotizacionPDF(detalle)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                📄 Descargar PDF
              </button>
              {detalle.estado !== 'convertida' && (
                <>
                  {detalle.estado !== 'aprobada' && (
                    <Button variant="secondary" size="md" onClick={() => handleCambiarEstado('aprobada')} loading={cambiarEstadoMutation.isPending}>Aprobar</Button>
                  )}
                  {detalle.estado !== 'rechazada' && (
                    <Button variant="danger" size="md" onClick={() => handleCambiarEstado('rechazada')} loading={cambiarEstadoMutation.isPending}>Rechazar</Button>
                  )}
                  <Button onClick={() => setConvertId(detalle.id_cotizacion)}>Convertir en venta</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmar conversión */}
      <ConfirmDialog
        isOpen={!!convertId}
        onClose={() => setConvertId(null)}
        onConfirm={handleConvertir}
        closeOnConfirm={false}
        loading={convertirMutation.isPending}
        title="Convertir en venta"
        message="Se creará una orden de venta con los productos de esta cotización. ¿Continuar?"
        confirmText="Convertir"
        type="primary"
      />
    </div>
  )
}

export default Cotizaciones
