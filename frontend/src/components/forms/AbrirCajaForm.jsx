import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const AbrirCajaForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({ monto_apertura: '', notas: '' })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.monto_apertura === '' || parseFloat(formData.monto_apertura) < 0) {
      setErrors({ monto_apertura: 'Ingresa el fondo inicial (0 o mayor)' })
      return
    }
    onSubmit({
      monto_apertura: parseFloat(formData.monto_apertura),
      notas: formData.notas,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Indica el efectivo con el que inicia el turno (fondo de caja).
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Fondo de apertura <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          name="monto_apertura"
          value={formData.monto_apertura}
          onChange={handleChange}
          className={inputCls(errors.monto_apertura)}
          placeholder="0.00"
          autoFocus
        />
        {errors.monto_apertura && <p className="mt-1 text-xs text-red-500">{errors.monto_apertura}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          name="notas"
          value={formData.notas}
          onChange={handleChange}
          rows={2}
          className={inputCls(false) + ' resize-none'}
          placeholder="Observaciones de la apertura..."
        />
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
          Abrir caja
        </Button>
      </div>
    </form>
  )
}

export default AbrirCajaForm
