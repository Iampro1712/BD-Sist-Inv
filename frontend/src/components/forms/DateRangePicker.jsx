import { useState } from 'react'

/**
 * Componente para seleccionar rango de fechas
 */
const DateRangePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = 'Fecha Inicio',
  endLabel = 'Fecha Fin',
  required = false,
  className = '',
}) => {
  const [error, setError] = useState('')

  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value
    onStartDateChange(newStartDate)

    // Validar que la fecha de inicio no sea mayor que la fecha de fin
    if (endDate && newStartDate > endDate) {
      setError('La fecha de inicio no puede ser mayor que la fecha de fin')
    } else {
      setError('')
    }
  }

  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value
    onEndDateChange(newEndDate)

    // Validar que la fecha de fin no sea menor que la fecha de inicio
    if (startDate && newEndDate < startDate) {
      setError('La fecha de fin no puede ser menor que la fecha de inicio')
    } else {
      setError('')
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {startLabel}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
            required={required}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {endLabel}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
            required={required}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}

export default DateRangePicker
