import { useState, useEffect } from 'react'
import { Button, Modal } from '../ui'
import { motion } from 'framer-motion'

const MotoForm = ({ isOpen, onClose, onSubmit, initialData = null, clienteId }) => {
  const [formData, setFormData] = useState({
    id_cliente: clienteId || '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    placa: ''
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else if (clienteId) {
      setFormData(prev => ({ ...prev, id_cliente: clienteId }))
    }
  }, [initialData, clienteId])

  const validate = () => {
    const newErrors = {}

    if (!formData.marca.trim()) {
      newErrors.marca = 'La marca es requerida'
    }

    if (!formData.modelo.trim()) {
      newErrors.modelo = 'El modelo es requerido'
    }

    if (!formData.anio || formData.anio < 1900 || formData.anio > new Date().getFullYear() + 1) {
      newErrors.anio = 'El año debe ser válido'
    }

    if (!formData.placa.trim()) {
      newErrors.placa = 'La placa es requerida'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      handleClose()
    } catch (error) {
      console.error('Error al guardar moto:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      id_cliente: clienteId || '',
      marca: '',
      modelo: '',
      anio: new Date().getFullYear(),
      placa: ''
    })
    setErrors({})
    onClose()
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'anio' ? parseInt(value) || '' : value
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialData ? 'Editar Moto' : 'Agregar Nueva Moto'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="marca" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Marca *
          </label>
          <input
            type="text"
            id="marca"
            name="marca"
            value={formData.marca}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
              errors.marca ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Honda, Yamaha, Suzuki..."
          />
          {errors.marca && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.marca}</p>
          )}
        </div>

        <div>
          <label htmlFor="modelo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Modelo *
          </label>
          <input
            type="text"
            id="modelo"
            name="modelo"
            value={formData.modelo}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
              errors.modelo ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="CB190R, FZ-16..."
          />
          {errors.modelo && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.modelo}</p>
          )}
        </div>

        <div>
          <label htmlFor="anio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Año *
          </label>
          <input
            type="number"
            id="anio"
            name="anio"
            value={formData.anio}
            onChange={handleChange}
            min="1900"
            max={new Date().getFullYear() + 1}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
              errors.anio ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.anio && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.anio}</p>
          )}
        </div>

        <div>
          <label htmlFor="placa" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Placa *
          </label>
          <input
            type="text"
            id="placa"
            name="placa"
            value={formData.placa}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
              errors.placa ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="ABC123"
          />
          {errors.placa && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.placa}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar' : 'Agregar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default MotoForm
