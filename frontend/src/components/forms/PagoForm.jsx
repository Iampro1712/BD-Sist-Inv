import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const PagoForm = ({ orden, onSubmit, onCancel, isLoading = false }) => {
  const saldoPendiente = orden.saldo_pendiente ?? orden.total ?? 0

  const [formData, setFormData] = useState({
    monto: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'efectivo',
    referencia: '',
    notas: '',
  })

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      errs.monto = 'El monto debe ser mayor a cero'
    } else if (parseFloat(formData.monto) > saldoPendiente) {
      errs.monto = `El monto no puede exceder el saldo pendiente (${formatCurrency(saldoPendiente)})`
    }
    if (!formData.fecha_pago) errs.fecha_pago = 'La fecha es requerida'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      ...formData,
      monto: parseFloat(formData.monto),
    })
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Información de la venta */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total de la venta:</span>
            <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(orden.total)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Saldo pendiente:</span>
            <p className="font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(saldoPendiente)}</p>
          </div>
        </div>
      </div>

      {/* Monto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Monto del pago <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={saldoPendiente}
          name="monto"
          value={formData.monto}
          onChange={handleChange}
          className={inputCls(errors.monto)}
          placeholder="0.00"
        />
        {errors.monto && <p className="mt-1 text-xs text-red-500">{errors.monto}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fecha de pago <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="fecha_pago"
            value={formData.fecha_pago}
            onChange={handleChange}
            max={new Date().toISOString().split('T')[0]}
            className={inputCls(errors.fecha_pago)}
          />
          {errors.fecha_pago && <p className="mt-1 text-xs text-red-500">{errors.fecha_pago}</p>}
        </div>

        {/* Método de pago */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Método de pago
          </label>
          <select
            name="metodo_pago"
            value={formData.metodo_pago}
            onChange={handleChange}
            className={inputCls(false)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="deposito">Depósito</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Referencia */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Referencia <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          name="referencia"
          value={formData.referencia}
          onChange={handleChange}
          className={inputCls(false)}
          placeholder="Ej: N° de comprobante, N° de transacción"
        />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          name="notas"
          value={formData.notas}
          onChange={handleChange}
          rows={2}
          placeholder="Observaciones sobre el pago..."
          className={inputCls(false) + ' resize-none'}
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          Registrar pago
        </Button>
      </div>
    </form>
  )
}

export default PagoForm
