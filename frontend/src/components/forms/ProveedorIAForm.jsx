import { useState, useEffect } from 'react'
import { Button, Combobox, Input } from '../ui'
import { useModelosIA } from '../../hooks/useConfiguracionIA'

/**
 * Alta o edición de un proveedor de IA.
 *
 * El alta es en **dos pasos** y no por gusto: la lista de modelos la da el
 * proveedor, y para preguntarle hace falta la clave. Así que primero se guarda
 * la clave y recién después se puede elegir el modelo. La alternativa —una
 * lista escrita a mano en el código— envejece: ofrece modelos ya retirados y
 * esconde los nuevos, y encima no sabe a cuáles tiene acceso esta cuenta.
 *
 * Al editar, el campo de la clave queda vacío a propósito: la clave nunca
 * vuelve del backend. Dejarlo vacío conserva la que está guardada.
 */
const ProveedorIAForm = ({
  proveedores = [],
  configuracion = null,   // si viene, es edición
  onSubmit,
  onCancel,
  isLoading,
}) => {
  const editando = !!configuracion
  const [proveedor, setProveedor] = useState(configuracion?.proveedor || '')
  const [apiKey, setApiKey] = useState('')
  const [modelo, setModelo] = useState(configuracion?.modelo || '')
  const [activo, setActivo] = useState(configuracion?.activo || false)
  const [verClave, setVerClave] = useState(false)
  const [manual, setManual] = useState(false)

  const elegido = proveedores.find((p) => p.id === proveedor)

  // Solo tiene sentido preguntar por los modelos si ya hay una clave guardada.
  const {
    data: listado, isLoading: cargandoModelos, error: errorModelos, refetch,
  } = useModelosIA(configuracion?.id_configuracion, editando && configuracion?.tiene_clave)

  const modelos = listado?.modelos || []
  // El backend responde 400 cuando no pudo traer la lista (clave rechazada,
  // proveedor caído, formato cambiado). Ahí se ofrece escribir el nombre.
  const detalleFallo = errorModelos?.response?.data?.detalle
    || errorModelos?.response?.data?.error

  // Si la cuenta no tiene el modelo que estaba guardado (lo retiraron, o cambió
  // el plan), no se deja seleccionado algo que ya no existe.
  useEffect(() => {
    if (!modelos.length || !modelo) return
    if (!modelos.some((m) => m.id === modelo)) setManual(true)
  }, [listado])   // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault()
    const datos = { proveedor, activo }
    if (apiKey.trim()) datos.api_key = apiKey.trim()
    if (modelo.trim()) datos.modelo = modelo.trim()
    onSubmit(datos)
  }

  const faltaClave = !editando && !apiKey.trim()
  const usarTexto = manual || (!cargandoModelos && !modelos.length)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Combobox
        label="Proveedor"
        value={proveedor}
        onChange={setProveedor}
        options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
        placeholder="Elegí un proveedor..."
        disabled={editando}
      />

      <div>
        <Input
          label={editando ? 'Nueva clave (opcional)' : 'Clave de API'}
          type={verClave ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            editando
              ? `Dejalo vacío para conservar ${configuracion.api_key_enmascarada || 'la actual'}`
              : elegido ? `${elegido.prefijo_clave}...` : 'Elegí primero el proveedor'
          }
          autoComplete="off"
          spellCheck={false}
        />
        <div className="flex items-center justify-between mt-1.5">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={verClave}
              onChange={(e) => setVerClave(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600" />
            Mostrar
          </label>
          {elegido && (
            <a href={elegido.donde_obtenerla} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
              Obtener una clave de {elegido.nombre}
            </a>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Se guarda cifrada y no vuelve a mostrarse completa. Queda fuera de los
          respaldos.
        </p>
      </div>

      {!editando ? (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-3 py-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              El modelo se elige después de guardar.
            </span>{' '}
            La lista la da {elegido?.nombre || 'el proveedor'} con tu clave, así
            que aparecen los modelos que tu cuenta tiene disponibles hoy.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Modelo
            </label>
            {!cargandoModelos && (
              <button type="button" onClick={() => refetch()}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                Actualizar lista
              </button>
            )}
          </div>

          {cargandoModelos ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
              Consultando los modelos de {configuracion.nombre_proveedor}...
            </p>
          ) : usarTexto ? (
            <>
              <Input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Nombre exacto del modelo"
                spellCheck={false}
              />
              {modelos.length > 0 && (
                <button type="button" onClick={() => setManual(false)}
                  className="mt-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline">
                  Elegir de la lista
                </button>
              )}
            </>
          ) : (
            <>
              <Combobox
                value={modelo}
                onChange={setModelo}
                options={modelos.map((m) => ({
                  value: m.id,
                  label: m.nombre,
                  badge: m.id === listado?.modelo_sugerido ? 'recomendado' : null,
                }))}
                placeholder="Elegí un modelo..."
                searchPlaceholder="Buscar modelo..."
                emptyText="Ningún modelo coincide"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {modelos.length} disponibles en tu cuenta
                </span>
                <button type="button" onClick={() => setManual(true)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
                  Escribir el nombre a mano
                </button>
              </div>
            </>
          )}

          {detalleFallo && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              No se pudo traer la lista: {detalleFallo} Podés escribir el nombre
              del modelo a mano.
            </p>
          )}
        </div>
      )}

      {editando && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            disabled={!modelo.trim()}
            className="mt-0.5 rounded border-gray-300 dark:border-gray-600 disabled:opacity-50" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Usar este proveedor
            <span className="block text-xs text-gray-400 dark:text-gray-500">
              {modelo.trim()
                ? 'Solo puede haber uno activo; al marcarlo se desactiva el anterior.'
                : 'Elegí un modelo primero.'}
            </span>
          </span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isLoading || !proveedor || faltaClave}>
          {isLoading ? 'Guardando...' : editando ? 'Guardar' : 'Guardar y elegir modelo'}
        </Button>
      </div>
    </form>
  )
}

export default ProveedorIAForm
