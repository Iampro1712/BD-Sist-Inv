import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import { Button, Card, Modal, ConfirmDialog, Loader } from '../components/ui'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../hooks/useAuthStore'
import {
  useConfiguracionesIA, useCatalogoIA, useEstadoIA,
  useGuardarIA, useActivarIA, useProbarIA, useEliminarIA,
} from '../hooks/useConfiguracionIA'
import ProveedorIAForm from '../components/forms/ProveedorIAForm'
import { extraerMensajeError } from '../utils/errores'

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])


const formatFecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const Configuracion = () => {
  const [modal, setModal] = useState(null)        // 'nuevo' | 'editar'
  const [editando, setEditando] = useState(null)
  const [borrar, setBorrar] = useState(null)

  const toast = useToast()
  const esAdmin = useAuthStore((s) => s.user?.is_staff)

  const { data, isLoading, error } = useConfiguracionesIA()
  const { data: catalogo } = useCatalogoIA()
  const { data: estado } = useEstadoIA()
  const guardar = useGuardarIA()
  const activar = useActivarIA()
  const probar = useProbarIA()
  const eliminar = useEliminarIA()

  const configuraciones = lista(data)
  const proveedores = catalogo?.proveedores || []
  // Al dar de alta solo tiene sentido ofrecer los que todavía no están cargados;
  // para cambiarle la clave a uno existente está el botón Editar.
  const disponibles = proveedores.filter(
    (p) => !configuraciones.some((c) => c.proveedor === p.id))

  if (!esAdmin) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Solo administradores
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Esta sección guarda claves de API. Pedile acceso a un administrador.
        </p>
      </Card>
    )
  }

  const handleGuardar = (datos) => {
    const eraAlta = !editando
    guardar.mutate(datos, {
      onSuccess: (res) => {
        if (eraAlta) {
          // Encadena al segundo paso en vez de cerrar y dejar al usuario con un
          // proveedor a medio configurar: la lista de modelos recién se puede
          // pedir ahora que la clave está guardada.
          toast.success('Clave guardada. Ahora elegí el modelo.')
          setEditando(res.data)
          setModal('editar')
          return
        }
        toast.success('Configuración actualizada')
        setModal(null)
        setEditando(null)
      },
      onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo guardar')),
    })
  }

  const handleActivar = (config) => {
    activar.mutate(config.id_configuracion, {
      onSuccess: () => toast.success(`${config.nombre_proveedor} es ahora el proveedor activo`),
      onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo activar')),
    })
  }

  const handleProbar = (config) => {
    probar.mutate(config.id_configuracion, {
      onSuccess: (res) => toast.success(res.data?.detalle || 'La clave funciona'),
      onError: (err) => toast.error(
        err.response?.data?.detalle || extraerMensajeError(err, 'No se pudo probar la clave')),
    })
  }

  const handleEliminar = () => {
    eliminar.mutate(borrar.id_configuracion, {
      onSuccess: () => {
        toast.success(`Se borró la clave de ${borrar.nombre_proveedor}`)
        setBorrar(null)
      },
      onError: (err) => toast.error(extraerMensajeError(err, 'No se pudo borrar')),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Proveedores de inteligencia artificial: clave, modelo y cuál se usa
          </p>
        </div>
        {disponibles.length > 0 && (
          <Button onClick={() => { setEditando(null); setModal('nuevo') }}>
            + Agregar proveedor
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          Error al cargar la configuración: {error.message}
        </div>
      )}

      <Card className="p-5">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          Proveedor en uso
        </p>
        {estado?.hay_proveedor_activo ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {estado.nombre_proveedor}
            </span>
            <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
              {estado.modelo}
            </span>
            {!estado.verificada && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                sin probar
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ninguno. Las funciones de IA no van a estar disponibles hasta que
            configures y actives un proveedor.
          </p>
        )}
      </Card>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader /></div>
      ) : configuraciones.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sin proveedores configurados
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            Agregá la clave de OpenAI, Gemini, DeepSeek o Anthropic. Se guarda
            cifrada, nunca se vuelve a mostrar completa y queda fuera de los
            respaldos.
          </p>
          <Button className="mt-4" onClick={() => { setEditando(null); setModal('nuevo') }}>
            + Agregar proveedor
          </Button>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {configuraciones.map((c) => (
            <motion.div key={c.id_configuracion} variants={fadeIn}>
              <Card className={`p-5 h-full transition-opacity ${c.activo
                ? 'ring-2 ring-primary-500 dark:ring-primary-400' : ''} ${
                borrar?.id_configuracion === c.id_configuracion && eliminar.isPending
                  ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {c.nombre_proveedor}
                      </h3>
                      {c.activo && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          en uso
                        </span>
                      )}
                      {c.verificada ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          verificada
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          sin probar
                        </span>
                      )}
                    </div>
                    {c.modelo ? (
                      <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {c.modelo}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Falta elegir el modelo
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {c.api_key_enmascarada || 'sin clave'}
                  </span>
                </div>

                {c.ultimo_error && (
                  <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                    {c.ultimo_error}
                  </p>
                )}

                <dl className="mt-3 text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                  {c.verificada && (
                    <div>Probada el {formatFecha(c.verificada_en)}</div>
                  )}
                  <div>
                    Actualizada el {formatFecha(c.actualizado_en)}
                    {c.actualizado_por ? ` por ${c.actualizado_por}` : ''}
                  </div>
                </dl>

                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={() => handleProbar(c)}
                    disabled={probar.isPending || !c.tiene_clave}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline">
                    {probar.isPending ? 'Probando...' : 'Probar clave'}
                  </button>
                  {!c.activo && (
                    <button onClick={() => handleActivar(c)}
                      disabled={activar.isPending || !c.tiene_clave || !c.modelo}
                      title={!c.modelo ? 'Elegí primero un modelo' : undefined}
                      className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-50 disabled:no-underline">
                      Usar este
                    </button>
                  )}
                  <button onClick={() => { setEditando(c); setModal('editar') }}
                    className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline">
                    {c.modelo ? 'Editar' : 'Elegir modelo'}
                  </button>
                  <button onClick={() => setBorrar(c)}
                    disabled={borrar?.id_configuracion === c.id_configuracion && eliminar.isPending}
                    className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:no-underline">
                    {borrar?.id_configuracion === c.id_configuracion && eliminar.isPending
                      ? 'Borrando...' : 'Borrar clave'}
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Modal isOpen={modal === 'nuevo'} onClose={() => setModal(null)}
        title="Agregar proveedor de IA">
        <ProveedorIAForm proveedores={disponibles} onSubmit={handleGuardar}
          onCancel={() => setModal(null)} isLoading={guardar.isPending} />
      </Modal>

      <Modal isOpen={modal === 'editar'} onClose={() => { setModal(null); setEditando(null) }}
        title={`Editar ${editando?.nombre_proveedor || 'proveedor'}`}>
        <ProveedorIAForm proveedores={proveedores} configuracion={editando}
          onSubmit={handleGuardar}
          onCancel={() => { setModal(null); setEditando(null) }}
          isLoading={guardar.isPending} />
      </Modal>

      <ConfirmDialog
        isOpen={!!borrar}
        onClose={() => setBorrar(null)}
        onConfirm={handleEliminar}
        title={`Borrar la clave de ${borrar?.nombre_proveedor || ''}`}
        message="La clave se borra de la base y no se puede recuperar: para volver a usar este proveedor habrá que pegarla de nuevo desde su panel."
        confirmText="Borrar clave"
        type="danger"
        loading={eliminar.isPending}
        // El diálogo se cierra recién cuando termina la eliminación (éxito o
        // error), no al hacer clic: así el spinner del botón alcanza a verse
        // en vez de desaparecer con el diálogo en el mismo instante.
        closeOnConfirm={false}
      />
    </div>
  )
}

export default Configuracion
