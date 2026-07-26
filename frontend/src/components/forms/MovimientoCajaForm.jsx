import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const MovimientoCajaForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({ tipo: 'retiro', monto: '', motivo: '' })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!formData.monto || parseFloat(formData.monto) <= 0) errs.monto = 'El monto debe ser mayor a cero'
    if (!formData.motivo.trim()) errs.motivo = 'Indica el motivo'
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({ tipo: formData.tipo, monto: parseFloat(formData.monto), motivo: formData.motivo.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Registra efectivo que entra o sale del cajón fuera de una venta (retiro para depósito,
        ingreso de cambio, devolución en efectivo...).
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
        <select name="tipo" value={formData.tipo} onChange={handleChange} className={inputCls(false)}>
          <option value="retiro">Retiro (sale efectivo)</option>
          <option value="ingreso">Ingreso (entra efectivo)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Monto <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          name="monto"
          value={formData.monto}
          onChange={handleChange}
          className={inputCls(errors.monto)}
          placeholder="0.00"
        />
        {errors.monto && <p className="mt-1 text-xs text-red-500">{errors.monto}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Motivo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="motivo"
          value={formData.motivo}
          onChange={handleChange}
          className={inputCls(errors.motivo)}
          placeholder="Ej: Depósito al banco, cambio para el cajón..."
        />
        {errors.motivo && <p className="mt-1 text-xs text-red-500">{errors.motivo}</p>}
      </div>

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
          Registrar movimiento
        </Button>
      </div>
    </form>
  )
}

export default MovimientoCajaForm
