import { useState } from 'react'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

const MODULOS_CONFIG = {
  recepcion: {
    label: 'Recepción',
    color: 'blue',
    icon: '📥',
  },
  diagnostico: {
    label: 'Diagnóstico',
    color: 'yellow',
    icon: '🔍',
  },
  reparacion: {
    label: 'Reparación',
    color: 'purple',
    icon: '🔧',
  },
  entrega: {
    label: 'Entrega',
    color: 'green',
    icon: '✅',
  },
}

export function BitacoraViewer({ bitacoras, onEliminarImagen }) {
  const [moduloActivo, setModuloActivo] = useState('recepcion')
  const [imagenAmpliada, setImagenAmpliada] = useState(null)

  const bitacorasFiltradas = bitacoras.filter(b => b.modulo === moduloActivo)

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-NI', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderCampoEspecifico = (bitacora) => {
    switch (bitacora.modulo) {
      case 'recepcion':
        return (
          <>
            {bitacora.nivel_gasolina && (
              <div className="mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Nivel de Gasolina:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{bitacora.nivel_gasolina}</span>
              </div>
            )}
            {bitacora.rayones_previos && (
              <div className="mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Rayones Previos:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{bitacora.rayones_previos}</p>
              </div>
            )}
          </>
        )
      
      case 'diagnostico':
        return bitacora.fallas_encontradas && (
          <div className="mb-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">Fallas Encontradas:</span>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{bitacora.fallas_encontradas}</p>
          </div>
        )
      
      case 'reparacion':
        return (
          <>
            {bitacora.trabajo_realizado && (
              <div className="mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Trabajo Realizado:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{bitacora.trabajo_realizado}</p>
              </div>
            )}
            {bitacora.tecnico_responsable && (
              <div className="mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Técnico:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{bitacora.tecnico_responsable}</span>
              </div>
            )}
          </>
        )
      
      case 'entrega':
        return (
          <>
            {bitacora.checklist_salida && (
              <div className="mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Checklist:</span>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{bitacora.checklist_salida}</p>
              </div>
            )}
            {bitacora.firma_cliente && (
              <div className="mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">Recibido por:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{bitacora.firma_cliente}</span>
              </div>
            )}
          </>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs de módulos */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {Object.entries(MODULOS_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setModuloActivo(key)}
            className={`px-4 py-2 font-medium transition-colors ${
              moduloActivo === key
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span className="mr-2">{config.icon}</span>
            {config.label}
          </button>
        ))}
      </div>

      {/* Contenido de bitácoras */}
      <div className="space-y-4">
        {bitacorasFiltradas.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No hay registros en este módulo
          </div>
        ) : (
          bitacorasFiltradas.map((bitacora) => (
            <div
              key={bitacora.id_bitacora}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <Badge color={MODULOS_CONFIG[bitacora.modulo].color}>
                    {bitacora.modulo_display}
                  </Badge>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatFecha(bitacora.fecha_registro)}
                  </p>
                </div>
                {bitacora.creado_por && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Por: {bitacora.creado_por}
                  </p>
                )}
              </div>

              {/* Campos específicos */}
              {renderCampoEspecifico(bitacora)}

              {/* Notas generales */}
              {bitacora.notas && (
                <div className="mb-3">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Notas:</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{bitacora.notas}</p>
                </div>
              )}

              {/* Imágenes */}
              {bitacora.imagenes && bitacora.imagenes.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Imágenes ({bitacora.imagenes.length}):
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {bitacora.imagenes.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Imagen ${index + 1}`}
                          loading="lazy"
                          className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={() => setImagenAmpliada(url)}
                        />
                        {onEliminarImagen && (
                          <button
                            onClick={() => onEliminarImagen(bitacora.id_bitacora, url)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal de imagen ampliada */}
      {imagenAmpliada && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setImagenAmpliada(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={imagenAmpliada}
              alt="Imagen ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setImagenAmpliada(null)}
              className="absolute top-4 right-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
