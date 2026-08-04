import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { Button, Card, Modal, ConfirmDialog, Loader } from '../components/ui'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../hooks/useAuthStore'
import {
  useUbicaciones, useCrearUbicacion, useActualizarUbicacion,
  useEliminarUbicacion, useProductosDeUbicacion,
} from '../hooks/useUbicaciones'
import UbicacionForm from '../components/forms/UbicacionForm'
import { extraerMensajeError } from '../utils/errores'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])


const Ubicaciones = () => {
  const [modal, setModal] = useState(null)          // 'nueva' | 'editar'
  const [editando, setEditando] = useState(null)
  const [borrarId, setBorrarId] = useState(null)
  const [verId, setVerId] = useState(null)

  const toast = useToast()
  const esAdmin = useAuthStore((s) => s.user?.is_staff)

  const { data, isLoading, error } = useUbicaciones()
  const { data: contenido, isLoading: cargandoContenido } = useProductosDeUbicacion(verId)
  const crear = useCrearUbicacion()
  const actualizar = useActualizarUbicacion()
  const eliminar = useEliminarUbicacion()

  const ubicaciones = lista(data)
  const bodegas = [...new Set(ubicaciones.map((u) => u.bodega))].sort()
  const totalProductos = ubicaciones.reduce((a, u) => a + (u.total_productos || 0), 0)
  const valorTotal = ubicaciones.reduce((a, u) => a + (u.valor_inventario || 0), 0)

  const handleCrear = (datos) => {
    crear.mutate(datos, {
      onSuccess: () => { toast.success('Ubicación creada'); setModal(null) },
      onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo crear la ubicación')),
    })
  }

  const handleActualizar = (datos) => {
    actualizar.mutate({ id: editando.id_ubicacion, ...datos }, {
      onSuccess: () => { toast.success('Ubicación actualizada'); setModal(null); setEditando(null) },
      onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo actualizar')),
    })
  }

  const handleEliminar = () => {
    eliminar.mutate(borrarId, {
      onSuccess: () => {
        toast.success('Ubicación eliminada; los productos quedaron sin ubicar')
        setBorrarId(null)
      },
      onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo eliminar')),
    })
  }

  const ubicacionVista = ubicaciones.find((u) => u.id_ubicacion === verId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ubicaciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dónde está guardado cada producto: bodega, pasillo, estante y gaveta
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/productos?sin_ubicacion=true"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Productos sin ubicar
          </Link>
          {esAdmin && <Button onClick={() => setModal('nueva')}>+ Nueva ubicación</Button>}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar ubicaciones: {error.message}
        </div>
      )}

      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Lugares</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{ubicaciones.length}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Productos ubicados</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalProductos}</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn}>
          <Card className="p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Valor almacenado</p>
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{formatCurrency(valorTotal)}</p>
          </Card>
        </motion.div>
      </motion.div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader /></div>
      ) : ubicaciones.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sin ubicaciones</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Creá los lugares donde guardás el inventario y luego asignalos a los productos.
          </p>
          {esAdmin && <Button className="mt-4" onClick={() => setModal('nueva')}>+ Nueva ubicación</Button>}
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ubicación</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bodega</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Productos</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ubicaciones.map((u) => (
                  <motion.tr key={u.id_ubicacion} variants={fadeIn}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                        {u.codigo}
                      </span>
                      {!u.activo && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          inactiva
                        </span>
                      )}
                      {u.notas && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{u.notas}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{u.bodega}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-white">
                      {u.total_productos}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(u.valor_inventario)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => setVerId(u.id_ubicacion)}
                        className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                        Ver contenido
                      </button>
                      {esAdmin && (
                        <>
                          <button onClick={() => { setEditando(u); setModal('editar') }}
                            className="ml-3 text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline">
                            Editar
                          </button>
                          <button onClick={() => setBorrarId(u.id_ubicacion)}
                            className="ml-3 text-xs font-medium text-red-600 dark:text-red-400 hover:underline">
                            Borrar
                          </button>
                        </>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <Modal isOpen={modal === 'nueva'} onClose={() => setModal(null)} title="Nueva ubicación">
        <UbicacionForm bodegas={bodegas} onSubmit={handleCrear}
          onCancel={() => setModal(null)} isLoading={crear.isPending} />
      </Modal>

      <Modal isOpen={modal === 'editar'} onClose={() => { setModal(null); setEditando(null) }}
        title="Editar ubicación">
        {editando && (
          <UbicacionForm ubicacion={editando} bodegas={bodegas} onSubmit={handleActualizar}
            onCancel={() => { setModal(null); setEditando(null) }} isLoading={actualizar.isPending} />
        )}
      </Modal>

      <Modal isOpen={!!verId} onClose={() => setVerId(null)}
        title={`Contenido de ${ubicacionVista?.codigo || 'la ubicación'}`} size="lg">
        {cargandoContenido ? (
          <div className="py-8 flex justify-center"><Loader /></div>
        ) : (contenido || []).length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No hay productos guardados acá.
          </p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {contenido.map((p) => (
              <div key={p.id_producto} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{p.nombre}</p>
                  <p className="text-xs font-mono text-gray-400 dark:text-gray-500">{p.sku_producto}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {p.cantidad_actual} u.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatCurrency(p.precio_final)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!borrarId}
        onClose={() => setBorrarId(null)}
        onConfirm={handleEliminar}
        title="Eliminar ubicación"
        message="Los productos que estaban ahí quedarán sin ubicación, pero no se borran."
        confirmText="Eliminar"
        loading={eliminar.isPending}
      />
    </div>
  )
}

export default Ubicaciones
