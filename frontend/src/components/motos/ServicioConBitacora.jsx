import { useState } from 'react'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import { BitacoraViewer } from './BitacoraViewer'
import { BitacoraForm } from '../forms/BitacoraForm'
import { useBitacora } from '../../hooks/useBitacora'
import { useToast } from '../../hooks/useToast'

export function ServicioConBitacora({ servicio, moto, onClose }) {
  const [showBitacoraForm, setShowBitacoraForm] = useState(false)
  const { bitacoras, loading, crearBitacora, eliminarImagen } = useBitacora(servicio.id_servicio)
  const toast = useToast()

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-NI', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
      currencyDisplay: 'code'
    }).format(value || 0).replace('NIO', 'C$')
  }

  const handleCrearBitacora = async (formData) => {
    try {
      await crearBitacora(formData)
      toast.success('Registro de bitácora creado exitosamente')
      setShowBitacoraForm(false)
    } catch (error) {
      toast.error('Error al crear registro de bitácora')
    }
  }

  const handleEliminarImagen = async (idBitacora, imagenUrl) => {
    if (!confirm('¿Estás seguro de eliminar esta imagen?')) return

    try {
      await eliminarImagen(idBitacora, imagenUrl)
      toast.success('Imagen eliminada exitosamente')
    } catch (error) {
      toast.error('Error al eliminar imagen')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Bitácora de Servicio
            </h2>
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Moto:</span> {moto.marca} {moto.modelo} ({moto.placa})
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Servicio:</span> {servicio.tipo_servicio}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Fecha:</span> {formatDate(servicio.fecha_servicio)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Costo:</span> {formatCurrency(servicio.costo)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Descripción del servicio */}
          {servicio.descripcion && (
            <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-900/20">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Descripción:</span> {servicio.descripcion}
              </p>
            </Card>
          )}

          {/* Botón para agregar registro */}
          <div className="mb-6">
            <Button
              onClick={() => setShowBitacoraForm(true)}
              className="w-full sm:w-auto"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Registro a Bitácora
            </Button>
          </div>

          {/* Bitácora */}
          {loading && bitacoras.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Cargando bitácora...</p>
            </div>
          ) : (
            <BitacoraViewer
              bitacoras={bitacoras}
              onEliminarImagen={handleEliminarImagen}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cerrar
          </Button>
        </div>
      </div>

      {/* Modal de formulario */}
      {showBitacoraForm && (
        <BitacoraForm
          isOpen={showBitacoraForm}
          onClose={() => setShowBitacoraForm(false)}
          onSubmit={handleCrearBitacora}
          servicio={servicio}
          moto={moto}
        />
      )}
    </div>
  )
}
