import { useState, useEffect } from 'react'
import { Input, Button, Select } from '../ui'

const ClienteForm = ({ cliente = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
  })

  const [errors, setErrors] = useState({})

  // Función para formatear el teléfono automáticamente
  const formatPhoneNumber = (value) => {
    // Extraer solo los dígitos
    const digitsOnly = value.replace(/\D/g, '')
    
    let phoneDigits = digitsOnly
    
    // Si empieza con 505 (código de Nicaragua), extraer los siguientes 8 dígitos
    if (digitsOnly.startsWith('505') && digitsOnly.length > 3) {
      phoneDigits = digitsOnly.slice(3, 11) // Tomar 8 dígitos después del 505
    } else {
      // Si no tiene código de país, tomar los primeros 8 dígitos
      phoneDigits = digitsOnly.slice(0, 8)
    }
    
    // Formatear según la cantidad de dígitos
    if (phoneDigits.length <= 4) {
      return phoneDigits
    }
    
    // Formato: 8888-8888
    return `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`
  }

  useEffect(() => {
    if (cliente) {
      setFormData({
        nombre: cliente.nombre || '',
        telefono: cliente.telefono || '',
        email: cliente.email || '',
      })
    }
  }, [cliente])

  const handleChange = (e) => {
    const { name, value } = e.target
    
    let processedValue = value
    
    // Formateo automático para teléfono
    if (name === 'telefono') {
      // Formatear el valor
      processedValue = formatPhoneNumber(value)
      
      // Extraer solo los dígitos para validación
      const digitsOnly = processedValue.replace(/\D/g, '')
      
      // Validación en tiempo real
      if (digitsOnly.length > 0 && digitsOnly.length < 8) {
        setErrors(prev => ({ ...prev, telefono: 'El teléfono debe tener al menos 8 dígitos' }))
      } else if (errors.telefono) {
        setErrors(prev => ({ ...prev, telefono: '' }))
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }))
    
    // Clear error when user types (except for telefono which has real-time validation)
    if (errors[name] && name !== 'telefono') {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido'
    
    if (!formData.telefono.trim()) {
      newErrors.telefono = 'El teléfono es requerido'
    } else {
      // Extraer solo los dígitos del teléfono
      const digitsOnly = formData.telefono.replace(/\D/g, '')
      if (digitsOnly.length < 8) {
        newErrors.telefono = 'El teléfono debe tener al menos 8 dígitos'
      }
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El email no es válido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  // Verificar si todos los campos requeridos están llenos
  const isFormValid = formData.nombre.trim() && formData.telefono.trim() && formData.email.trim()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre *"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          error={errors.nombre}
          placeholder="Nombre del cliente"
          required
        />

        <Input
          label="Teléfono *"
          name="telefono"
          type="tel"
          value={formData.telefono}
          onChange={handleChange}
          error={errors.telefono}
          placeholder="8888-8888"
          required
        />
      </div>

      <div>
        <Input
          label="Email *"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="correo@ejemplo.com"
          required
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={isLoading}
          disabled={isLoading || !isFormValid}
        >
          {cliente ? 'Actualizar' : 'Crear'} Cliente
        </Button>
      </div>
    </form>
  )
}

export default ClienteForm
