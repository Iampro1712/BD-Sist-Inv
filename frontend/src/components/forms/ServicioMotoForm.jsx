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
  const [serviciosAgregados, setServiciosAgregados] = useState([])
  const [modoMultiple, setModoMultiple] = useState(false)

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

    // Si está en modo múltiple, agregar a la lista
    if (modoMultiple) {
      agregarServicio()
      return
    }

    // Si no está en modo múltiple, guardar directamente
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

  const agregarServicio = () => {
    const nuevoServicio = {
      ...formData,
      costo: parseFloat(formData.costo),
      id_temp: Date.now() // ID temporal para la lista
    }
    
    setServiciosAgregados(prev => [...prev, nuevoServicio])
    
    // Limpiar formulario pero mantener fecha y moto
    setFormData({
      id_moto: motoId || '',
      fecha_servicio: formData.fecha_servicio,
      tipo_servicio: '',
      descripcion: '',
      costo: ''
    })
    setErrors({})
  }

  const eliminarServicio = (id_temp) => {
    setServiciosAgregados(prev => prev.filter(s => s.id_temp !== id_temp))
  }

  const guardarTodosLosServicios = async () => {
    if (serviciosAgregados.length === 0) {
      setErrors({ general: 'Debes agregar al menos un servicio' })
      return
    }

    setIsSubmitting(true)
    try {
      // Guardar todos los servicios
      for (const servicio of serviciosAgregados) {
        const { id_temp, ...servicioData } = servicio
        await onSubmit(servicioData)
      }
      handleClose()
    } catch (error) {
      console.error('Error al guardar servicios:', error)
      setErrors({ general: 'Error al guardar los servicios' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const calcularTotalServicios = () => {
    return serviciosAgregados.reduce((total, servicio) => total + servicio.costo, 0)
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
    setServiciosAgregados([])
    setModoMultiple(false)
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
      title={initialData ? 'Editar Servicio' : 'Registrar Servicio(s)'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle para modo múltiple */}
        {!initialData && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {modoMultiple ? 'Modo: Múltiples Servicios' : 'Modo: Servicio Único'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setModoMultiple(!modoMultiple)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                modoMultiple ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  modoMultiple ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}

        {errors.general && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
          </div>
        )}
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

        {/* Lista de servicios agregados (solo en modo múltiple) */}
        {modoMultiple && serviciosAgregados.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Servicios Agregados ({serviciosAgregados.length})
              </h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {serviciosAgregados.map((servicio) => (
                <div
                  key={servicio.id_temp}
                  className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {servicio.tipo_servicio}
                    </p>
                    {servicio.descripcion && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {servicio.descripcion}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      C${servicio.costo.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarServicio(servicio.id_temp)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total:
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  C${calcularTotalServicios().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          
          {modoMultiple ? (
            <>
              <Button
                type="submit"
                variant="secondary"
                disabled={isSubmitting}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Servicio
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={guardarTodosLosServicios}
                disabled={isSubmitting || serviciosAgregados.length === 0}
              >
                {isSubmitting ? 'Guardando...' : `Guardar Todos (${serviciosAgregados.length})`}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar' : 'Registrar'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default ServicioMotoForm
