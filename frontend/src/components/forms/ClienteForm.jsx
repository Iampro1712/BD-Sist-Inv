import { useState, useEffect } from 'react'
import { Input, Button, Select } from '../ui'

const ClienteForm = ({ cliente = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
  })

  const [errors, setErrors] = useState({})

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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido'
    if (!formData.telefono.trim()) newErrors.telefono = 'El teléfono es requerido'
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
          value={formData.telefono}
          onChange={handleChange}
          error={errors.telefono}
          placeholder="Ej: 555-1234"
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
