import { useState, useEffect } from 'react'
import { Input, Button } from '../ui'

const ProveedorForm = ({ proveedor = null, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    nombre_empresa: '',
    persona_contacto: '',
    telefono: '',
    email: '',
    direccion: '',
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (proveedor) {
      setFormData({
        nombre_empresa: proveedor.nombre_empresa || '',
        persona_contacto: proveedor.persona_contacto || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        direccion: proveedor.direccion || '',
      })
    }
  }, [proveedor])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.nombre_empresa.trim()) newErrors.nombre_empresa = 'El nombre de la empresa es requerido'
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

  const isFormValid = formData.nombre_empresa.trim() && formData.telefono.trim() && formData.email.trim()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre de la Empresa *"
          name="nombre_empresa"
          value={formData.nombre_empresa}
          onChange={handleChange}
          error={errors.nombre_empresa}
          placeholder="Nombre del proveedor"
          required
        />

        <Input
          label="Persona de Contacto"
          name="persona_contacto"
          value={formData.persona_contacto}
          onChange={handleChange}
          placeholder="Nombre del contacto"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Teléfono *"
          name="telefono"
          value={formData.telefono}
          onChange={handleChange}
          error={errors.telefono}
          placeholder="Ej: 555-1234"
          required
        />

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

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Dirección
        </label>
        <textarea
          name="direccion"
          value={formData.direccion}
          onChange={handleChange}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Dirección del proveedor"
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
          {proveedor ? 'Actualizar' : 'Crear'} Proveedor
        </Button>
      </div>
    </form>
  )
}

export default ProveedorForm
