import { useState, useEffect } from 'react'
import { Button, Modal } from '../ui'
import api from '../../services/api'

const ServicioMotoForm = ({ isOpen, onClose, onSubmit, initialData = null, motoId }) => {
  const [formData, setFormData] = useState({
    id_moto: motoId || '',
    fecha_servicio: new Date().toISOString().split('T')[0],
    tipo_servicio: '',
    descripcion: '',
    costo: ''
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [servicios, setServicios] = useState([])
  const [isLoadingServicios, setIsLoadingServicios] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchServicios()
    }
  }, [isOpen])

  const fetchServicios = async () => {
    setIsLoadingServicios(true)
    try {
      const response = await api.get('/servicios/')
      setServicios(response.data || [])
    } catch (error) {
      console.error('Error al cargar servicios:', error)
    } finally {
      setIsLoadingServicios(false)
    }
  }

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else if (motoId) {
      setFormData(prev => ({ ...prev, id_moto: motoId }))
    }
  }, [initialData, motoId])

  const validate = () => {
    const newErrors = {}

    if (!formData.fecha_servicio) {
      newErrors.fecha_servicio = 'La fecha es requerida'
    }

    if (!formData.tipo_servicio.trim()) {
      newErrors.tipo_servicio = 'El tipo de servicio es requerido'
    }

    if (!formData.costo || parseFloat(formData.costo) <= 0) {
      newErrors.costo = 'El costo debe ser mayor a 0'
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
      await onSubmit({
        ...formData,
        costo: parseFloat(formData.costo)
      })
      handleClose()
    } catch (error) {
      console.error('Error al guardar servicio:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      id_moto: motoId || '',
      fecha_servicio: new Date().toISOString().split('T')[0],
      tipo_servicio: '',
      descripcion: '',
      costo: ''
    })
    setErrors({})
    onClose()
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    // Si cambia el tipo de servicio, autocompletar el costo
    if (name === 'tipo_servicio') {
      const servicioSeleccionado = servicios.find(s => s.nombre === value)
      setFormData(prev => ({
        ...prev,
        [name]: value,
        costo: servicioSeleccionado ? servicioSeleccionado.precio_mano_obra : ''
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialData ? 'Editar Servicio' : 'Registrar Nuevo Servicio'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fecha_servicio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fecha del Servicio *
          </label>
          <input
            type="date"
            id="fecha_servicio"
            name="fecha_servicio"
            value={formData.fecha_servicio}
            onChange={handleChange}
            max={new Date().toISOString().split('T')[0]}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
              errors.fecha_servicio ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {errors.fecha_servicio && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.fecha_servicio}</p>
          )}
        </div>

        <div>
          <label htmlFor="tipo_servicio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipo de Servicio *
          </label>
          <select
            id="tipo_servicio"
            name="tipo_servicio"
            value={formData.tipo_servicio}
            onChange={handleChange}
            disabled={isLoadingServicios}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
              errors.tipo_servicio ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            } ${isLoadingServicios ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">
              {isLoadingServicios ? 'Cargando servicios...' : 'Seleccionar tipo...'}
            </option>
            {servicios.map((servicio, index) => (
              <option key={index} value={servicio.nombre}>
                {servicio.nombre} - C${servicio.precio_mano_obra}
              </option>
            ))}
          </select>
          {errors.tipo_servicio && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.tipo_servicio}</p>
          )}
        </div>

        <div>
          <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Detalles del servicio realizado..."
          />
        </div>

        <div>
          <label htmlFor="costo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Costo (C$) *
          </label>
          <input
            type="number"
            id="costo"
            name="costo"
            value={formData.costo}
            onChange={handleChange}
            step="0.01"
            min="0"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
              errors.costo ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="0.00"
          />
          {errors.costo && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.costo}</p>
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
            {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ServicioMotoForm
