import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const GastoForm = ({ categorias = [], cajaAbierta = false, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    categoria: '',
    monto: '',
    metodo_pago: 'efectivo',
    descripcion: '',
    referencia: '',
  })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.categoria) errs.categoria = 'Selecciona una categoría'
    if (!formData.monto || parseFloat(formData.monto) <= 0) errs.monto = 'El monto debe ser mayor a cero'
    if (!formData.fecha) errs.fecha = 'La fecha es requerida'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      ...formData,
      categoria: parseInt(formData.categoria),
      monto: parseFloat(formData.monto),
    })
  }

  const esEfectivoSinCaja = formData.metodo_pago === 'efectivo' && !cajaAbierta

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Categoría <span className="text-red-500">*</span>
          </label>
          <select name="categoria" value={formData.categoria} onChange={handleChange} className={inputCls(errors.categoria)}>
            <option value="">Selecciona...</option>
            {categorias.filter((c) => c.activo).map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
            ))}
          </select>
          {errors.categoria && <p className="mt-1 text-xs text-red-500">{errors.categoria}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input type="date" name="fecha" value={formData.fecha} onChange={handleChange}
            max={new Date().toISOString().split('T')[0]} className={inputCls(errors.fecha)} />
          {errors.fecha && <p className="mt-1 text-xs text-red-500">{errors.fecha}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Monto <span className="text-red-500">*</span>
          </label>
          <input type="number" step="0.01" min="0.01" name="monto" value={formData.monto}
            onChange={handleChange} className={inputCls(errors.monto)} placeholder="0.00" />
          {errors.monto && <p className="mt-1 text-xs text-red-500">{errors.monto}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de pago</label>
          <select name="metodo_pago" value={formData.metodo_pago} onChange={handleChange} className={inputCls(false)}>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="deposito">Depósito</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Aviso: gasto en efectivo sale del cajón y requiere caja abierta */}
      {esEfectivoSinCaja && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
          Un gasto en efectivo sale del cajón: necesitas una caja abierta, o
          registra el gasto con otro método de pago.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Descripción <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input type="text" name="descripcion" value={formData.descripcion} onChange={handleChange}
          className={inputCls(false)} placeholder="Detalle del gasto" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Referencia / comprobante <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input type="text" name="referencia" value={formData.referencia} onChange={handleChange}
          className={inputCls(false)} placeholder="N° de factura, recibo..." />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
          Cancelar
        </button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>Registrar gasto</Button>
      </div>
    </form>
  )
}

export default GastoForm
