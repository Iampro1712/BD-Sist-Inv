import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

// `sesion` trae `esperado_actual` (efectivo que el sistema calcula ahora mismo).
const CerrarCajaForm = ({ sesion, onSubmit, onCancel, isLoading = false }) => {
  const esperado = sesion?.esperado_actual ?? 0
  const [formData, setFormData] = useState({ monto_cierre_contado: '', notas: '' })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const contado = formData.monto_cierre_contado === '' ? null : parseFloat(formData.monto_cierre_contado)
  const diferencia = contado === null ? null : contado - esperado

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.monto_cierre_contado === '' || contado < 0) {
      setErrors({ monto_cierre_contado: 'Ingresa el efectivo contado (0 o mayor)' })
      return
    }
    onSubmit({ monto_cierre_contado: contado, notas: formData.notas })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Efectivo esperado por el sistema:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(esperado)}</span>
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Fondo de apertura + ventas en efectivo + ingresos − retiros. (Tarjeta/transferencia no cuentan.)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Efectivo contado <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          name="monto_cierre_contado"
          value={formData.monto_cierre_contado}
          onChange={handleChange}
          className={inputCls(errors.monto_cierre_contado)}
          placeholder="0.00"
          autoFocus
        />
        {errors.monto_cierre_contado && <p className="mt-1 text-xs text-red-500">{errors.monto_cierre_contado}</p>}
      </div>

      {/* Diferencia en vivo */}
      {diferencia !== null && (
        <div
          className={`rounded-lg p-3 text-sm font-medium ${
            diferencia === 0
              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : diferencia > 0
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
          {diferencia === 0
            ? 'Caja cuadrada exactamente.'
            : diferencia > 0
              ? `Sobrante de ${formatCurrency(diferencia)}`
              : `Faltante de ${formatCurrency(Math.abs(diferencia))}`}
        </div>
      )}

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
          placeholder="Explicación de la diferencia, observaciones..."
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
          Cerrar caja
        </Button>
      </div>
    </form>
  )
}

export default CerrarCajaForm
