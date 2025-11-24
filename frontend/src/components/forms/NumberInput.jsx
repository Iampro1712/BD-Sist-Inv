import { useState } from 'react'

/**
 * Componente de input numérico con validación
 */
const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = '0',
  required = false,
  disabled = false,
  allowDecimals = false,
  allowNegative = false,
  className = '',
  ...props
}) => {
  const [error, setError] = useState('')

  const handleChange = (e) => {
    let inputValue = e.target.value

    // Permitir campo vacío
    if (inputValue === '') {
      onChange('')
      setError('')
      return
    }

    // Validar formato numérico
    const regex = allowDecimals
      ? allowNegative
        ? /^-?\d*\.?\d*$/
        : /^\d*\.?\d*$/
      : allowNegative
      ? /^-?\d*$/
      : /^\d*$/

    if (!regex.test(inputValue)) {
      return // No actualizar si no cumple el formato
    }

    // Convertir a número para validaciones
    const numValue = parseFloat(inputValue)

    // Validar rango
    if (!isNaN(numValue)) {
      if (min !== undefined && numValue < min) {
        setError(`El valor mínimo es ${min}`)
      } else if (max !== undefined && numValue > max) {
        setError(`El valor máximo es ${max}`)
      } else {
        setError('')
      }
    }

    onChange(inputValue)
  }

  const handleBlur = () => {
    // Al perder el foco, formatear el valor si es necesario
    if (value !== '' && !isNaN(parseFloat(value))) {
      const numValue = parseFloat(value)
      
      // Aplicar límites
      let finalValue = numValue
      if (min !== undefined && finalValue < min) {
        finalValue = min
      }
      if (max !== undefined && finalValue > max) {
        finalValue = max
      }

      // Formatear decimales si es necesario
      if (allowDecimals && step < 1) {
        const decimals = step.toString().split('.')[1]?.length || 2
        finalValue = finalValue.toFixed(decimals)
      }

      onChange(finalValue.toString())
      setError('')
    }
  }

  const increment = () => {
    const currentValue = parseFloat(value) || 0
    const newValue = currentValue + step
    if (max === undefined || newValue <= max) {
      onChange(newValue.toString())
      setError('')
    }
  }

  const decrement = () => {
    const currentValue = parseFloat(value) || 0
    const newValue = currentValue - step
    if (min === undefined || newValue >= min) {
      onChange(newValue.toString())
      setError('')
    }
  }

  return (
    <div className={className}>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`block w-full px-4 py-2 pr-20 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
            error ? 'border-red-300' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          {...props}
        />

        {/* Botones de incremento/decremento */}
        <div className="absolute inset-y-0 right-0 flex flex-col border-l border-gray-300">
          <button
            type="button"
            onClick={increment}
            disabled={disabled || (max !== undefined && parseFloat(value) >= max)}
            className="px-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex-1 flex items-center justify-center border-b border-gray-300"
          >
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={decrement}
            disabled={disabled || (min !== undefined && parseFloat(value) <= min)}
            className="px-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex-1 flex items-center justify-center"
          >
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}

export default NumberInput
