import { useState, useMemo } from 'react'
import { Button } from '../ui'
import { useClientes } from '../../hooks/useClientes'
import { useUsuarios } from '../../hooks/useUsuarios'
import { useCatalogoServicios, useMotosDeCliente } from '../../hooks/useTaller'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const lista = (data) => (Array.isArray(data) ? data : data?.results || [])

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const AgendarServicioForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    cliente: '',
    id_moto: '',
    id_tipo_servicio: '',
    tipo_servicio: '',
    fecha_servicio: new Date().toISOString().split('T')[0],
    fecha_cita: '',
    id_mecanico: '',
    km_actual: '',
    descripcion: '',
  })
  const [errors, setErrors] = useState({})

  const { data: clientesData } = useClientes({ page_size: 200 })
  const { data: motosData, isLoading: cargandoMotos } = useMotosDeCliente(formData.cliente)
  const { data: catalogoData } = useCatalogoServicios()
  const { data: usuariosData } = useUsuarios()

  const clientes = lista(clientesData)
  const motos = lista(motosData)
  const catalogo = lista(catalogoData)
  const mecanicos = lista(usuariosData)

  const tipoElegido = useMemo(
    () => catalogo.find((t) => String(t.id_servicio) === String(formData.id_tipo_servicio)),
    [catalogo, formData.id_tipo_servicio]
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      // Cambiar de cliente invalida la moto elegida.
      if (name === 'cliente') next.id_moto = ''
      // Al elegir del catálogo se copia el nombre como descripción del trabajo.
      if (name === 'id_tipo_servicio') {
        const tipo = catalogo.find((t) => String(t.id_servicio) === String(value))
        next.tipo_servicio = tipo ? tipo.nombre : ''
      }
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.cliente) errs.cliente = 'Selecciona el cliente'
    if (!formData.id_moto) errs.id_moto = 'Selecciona la moto'
    if (!formData.tipo_servicio && !formData.id_tipo_servicio) {
      errs.id_tipo_servicio = 'Elegí un tipo de servicio o escribí uno'
    }
    if (!formData.fecha_servicio) errs.fecha_servicio = 'La fecha de ingreso es requerida'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      id_moto: parseInt(formData.id_moto),
      id_tipo_servicio: formData.id_tipo_servicio ? parseInt(formData.id_tipo_servicio) : null,
      tipo_servicio: formData.tipo_servicio || tipoElegido?.nombre || 'Servicio',
      fecha_servicio: formData.fecha_servicio,
      fecha_cita: formData.fecha_cita || null,
      id_mecanico: formData.id_mecanico ? parseInt(formData.id_mecanico) : null,
      km_actual: formData.km_actual ? parseInt(formData.km_actual) : null,
      descripcion: formData.descripcion || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cliente <span className="text-red-500">*</span>
          </label>
          <select name="cliente" value={formData.cliente} onChange={handleChange}
            className={inputCls(errors.cliente)}>
            <option value="">Selecciona...</option>
            {clientes.map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
            ))}
          </select>
          {errors.cliente && <p className="mt-1 text-xs text-red-500">{errors.cliente}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Moto <span className="text-red-500">*</span>
          </label>
          <select name="id_moto" value={formData.id_moto} onChange={handleChange}
            disabled={!formData.cliente || cargandoMotos} className={inputCls(errors.id_moto)}>
            <option value="">
              {!formData.cliente ? 'Elegí primero el cliente' : cargandoMotos ? 'Cargando...' : 'Selecciona...'}
            </option>
            {motos.map((m) => (
              <option key={m.id_moto} value={m.id_moto}>
                {m.marca} {m.modelo} ({m.placa})
              </option>
            ))}
          </select>
          {errors.id_moto && <p className="mt-1 text-xs text-red-500">{errors.id_moto}</p>}
          {formData.cliente && !cargandoMotos && motos.length === 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Este cliente no tiene motos registradas.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tipo de servicio <span className="text-red-500">*</span>
        </label>
        <select name="id_tipo_servicio" value={formData.id_tipo_servicio} onChange={handleChange}
          className={inputCls(errors.id_tipo_servicio)}>
          <option value="">Selecciona del catálogo...</option>
          {catalogo.map((t) => (
            <option key={t.id_servicio} value={t.id_servicio}>
              {t.nombre} — {formatCurrency(t.precio_mano_obra)}
            </option>
          ))}
        </select>
        {errors.id_tipo_servicio && <p className="mt-1 text-xs text-red-500">{errors.id_tipo_servicio}</p>}
        {tipoElegido && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Mano de obra: <strong>{formatCurrency(tipoElegido.precio_mano_obra)}</strong>.
            Los repuestos se agregan durante la reparación.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Descripción del trabajo
        </label>
        <input type="text" name="tipo_servicio" value={formData.tipo_servicio} onChange={handleChange}
          placeholder="Se llena con el tipo elegido; podés ajustarlo" className={inputCls(false)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fecha de ingreso <span className="text-red-500">*</span>
          </label>
          <input type="date" name="fecha_servicio" value={formData.fecha_servicio}
            onChange={handleChange} className={inputCls(errors.fecha_servicio)} />
          {errors.fecha_servicio && <p className="mt-1 text-xs text-red-500">{errors.fecha_servicio}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cita (opcional)
          </label>
          <input type="datetime-local" name="fecha_cita" value={formData.fecha_cita}
            onChange={handleChange} className={inputCls(false)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Kilometraje
          </label>
          <input type="number" name="km_actual" value={formData.km_actual} onChange={handleChange}
            min="0" placeholder="Ej: 12500" className={inputCls(false)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Mecánico asignado
        </label>
        <select name="id_mecanico" value={formData.id_mecanico} onChange={handleChange}
          className={inputCls(false)}>
          <option value="">Sin asignar</option>
          {mecanicos.map((u) => (
            <option key={u.id} value={u.id}>
              {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.username}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas
        </label>
        <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows={2}
          placeholder="Lo que reporta el cliente..." className={inputCls(false)} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Agendando...' : 'Agendar servicio'}
        </Button>
      </div>
    </form>
  )
}

export default AgendarServicioForm
