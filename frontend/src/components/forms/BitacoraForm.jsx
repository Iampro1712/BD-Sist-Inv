import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

const MODULOS = [
  { value: 'recepcion', label: 'Recepción' },
  { value: 'diagnostico', label: 'Diagnóstico' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'entrega', label: 'Entrega' },
]

export function BitacoraForm({ isOpen, onClose, onSubmit, servicio, moto }) {
  const [formData, setFormData] = useState({
    modulo: 'recepcion',
    notas: '',
    nivel_gasolina: '',
    rayones_previos: '',
    fallas_encontradas: '',
    trabajo_realizado: '',
    tecnico_responsable: '',
    checklist_salida: '',
    firma_cliente: '',
    creado_por: '',
  })
  
  const [imagenes, setImagenes] = useState([])
  const [previews, setPreviews] = useState([])
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    setImagenes(prev => [...prev, ...files])
    
    // Crear previews
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    setImagenes(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      
      // Agregar campos del formulario
      formDataToSend.append('id_servicio', servicio.id_servicio)
      formDataToSend.append('id_moto', moto.id_moto)
      formDataToSend.append('modulo', formData.modulo)
      
      Object.keys(formData).forEach(key => {
        if (formData[key] && key !== 'modulo') {
          formDataToSend.append(key, formData[key])
        }
      })
      
      // Agregar imágenes
      imagenes.forEach((imagen, index) => {
        formDataToSend.append(`imagenes_files`, imagen)
      })

      await onSubmit(formDataToSend)
      
      // Resetear formulario
      setFormData({
        modulo: 'recepcion',
        notas: '',
        nivel_gasolina: '',
        rayones_previos: '',
        fallas_encontradas: '',
        trabajo_realizado: '',
        tecnico_responsable: '',
        checklist_salida: '',
        firma_cliente: '',
        creado_por: '',
      })
      setImagenes([])
      setPreviews([])
      onClose()
    } catch (error) {
      console.error('Error al guardar bitácora:', error)
      alert('Error al guardar el registro. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const renderCamposEspecificos = () => {
    switch (formData.modulo) {
      case 'recepcion':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nivel de Gasolina
              </label>
              <select
                name="nivel_gasolina"
                value={formData.nivel_gasolina}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Seleccionar...</option>
                <option value="Vacío">Vacío</option>
                <option value="1/4">1/4</option>
                <option value="1/2">1/2</option>
                <option value="3/4">3/4</option>
                <option value="Lleno">Lleno</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rayones Previos
              </label>
              <textarea
                name="rayones_previos"
                value={formData.rayones_previos}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Describir rayones o daños previos..."
              />
            </div>
          </>
        )
      
      case 'diagnostico':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fallas Encontradas
            </label>
            <textarea
              name="fallas_encontradas"
              value={formData.fallas_encontradas}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Describir fallas encontradas..."
            />
          </div>
        )
      
      case 'reparacion':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trabajo Realizado
              </label>
              <textarea
                name="trabajo_realizado"
                value={formData.trabajo_realizado}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Describir trabajo realizado..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Técnico Responsable
              </label>
              <input
                type="text"
                name="tecnico_responsable"
                value={formData.tecnico_responsable}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Nombre del técnico..."
              />
            </div>
          </>
        )
      
      case 'entrega':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Checklist de Salida
              </label>
              <textarea
                name="checklist_salida"
                value={formData.checklist_salida}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Items verificados antes de la entrega..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Firma Cliente
              </label>
              <input
                type="text"
                name="firma_cliente"
                value={formData.firma_cliente}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Nombre del cliente que recibe..."
              />
            </div>
          </>
        )
      
      default:
        return null
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar Registro a Bitácora">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Información del servicio */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Moto:</span> {moto.marca} {moto.modelo} ({moto.placa})
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Servicio:</span> {servicio.tipo_servicio}
          </p>
        </div>

        {/* Módulo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Módulo *
          </label>
          <select
            name="modulo"
            value={formData.modulo}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {MODULOS.map(modulo => (
              <option key={modulo.value} value={modulo.value}>
                {modulo.label}
              </option>
            ))}
          </select>
        </div>

        {/* Campos específicos por módulo */}
        {renderCamposEspecificos()}

        {/* Notas generales */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notas Generales
          </label>
          <textarea
            name="notas"
            value={formData.notas}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Notas adicionales..."
          />
        </div>

        {/* Creado por */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Creado Por
          </label>
          <input
            type="text"
            name="creado_por"
            value={formData.creado_por}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Nombre de quien registra..."
          />
        </div>

        {/* Imágenes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Imágenes
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          
          {/* Previews */}
          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {previews.map((preview, index) => (
                <div key={index} className="relative">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {imagenes.length > 0 ? 'Subiendo imágenes...' : 'Guardando...'}
              </>
            ) : (
              'Guardar Registro'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
