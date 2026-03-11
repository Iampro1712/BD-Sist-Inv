import { Badge, Loader, Card, Button } from '../ui'
import { motion } from 'framer-motion'
import { fadeIn } from '../../utils/animations'
import { useState, useEffect } from 'react'
import api from '../../services/api'
import MotoForm from '../forms/MotoForm'
import ServicioMotoForm from '../forms/ServicioMotoForm'
import { ServicioConBitacora } from '../motos/ServicioConBitacora'

const ClienteDetalle = ({ cliente, ordenes = [], isLoadingOrdenes = false }) => {
  const [motos, setMotos] = useState([])
  const [isLoadingMotos, setIsLoadingMotos] = useState(false)
  const [selectedMoto, setSelectedMoto] = useState(null)
  const [servicios, setServicios] = useState([])
  const [isLoadingServicios, setIsLoadingServicios] = useState(false)
  const [showMotoForm, setShowMotoForm] = useState(false)
  const [showServicioForm, setShowServicioForm] = useState(false)
  const [servicioConBitacora, setServicioConBitacora] = useState(null)

  useEffect(() => {
    if (cliente?.id_cliente) {
      fetchMotos()
    }
  }, [cliente])

  const fetchMotos = async () => {
    setIsLoadingMotos(true)
    try {
      const response = await api.get(`/motos/?cliente=${cliente.id_cliente}`)
      // La API devuelve datos paginados, extraer results
      setMotos(response.data.results || response.data)
    } catch (error) {
      console.error('Error al cargar motos:', error)
    } finally {
      setIsLoadingMotos(false)
    }
  }

  const fetchServicios = async (motoId) => {
    setIsLoadingServicios(true)
    try {
      const response = await api.get(`/servicios-motos/?moto=${motoId}`)
      // La API devuelve datos paginados, extraer results
      setServicios(response.data.results || response.data)
    } catch (error) {
      console.error('Error al cargar servicios:', error)
    } finally {
      setIsLoadingServicios(false)
    }
  }

  const handleMotoClick = (moto) => {
    setSelectedMoto(moto)
    fetchServicios(moto.id_moto)
  }

  const handleAddMoto = async (motoData) => {
    try {
      await api.post('/motos/', motoData)
      fetchMotos()
    } catch (error) {
      console.error('Error al agregar moto:', error)
      throw error
    }
  }

  const handleAddServicio = async (servicioData) => {
    try {
      await api.post('/servicios-motos/', servicioData)
      if (selectedMoto) {
        fetchServicios(selectedMoto.id_moto)
      }
      fetchMotos()
    } catch (error) {
      console.error('Error al agregar servicio:', error)
      throw error
    }
  }

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

  const getEstadoBadgeVariant = (estado) => {
    const variants = {
      'pendiente': 'warning',
      'confirmada': 'info',
      'entregada': 'success',
      'cancelada': 'default'
    }
    return variants[estado] || 'default'
  }

  const getTipoClienteLabel = (tipo) => {
    return tipo === 'empresa' ? 'Empresa' : 'Particular'
  }

  return (
    <div className="space-y-6">
      {/* Información del Cliente */}
      <motion.div variants={fadeIn} initial="hidden" animate="visible">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-2 border-blue-100 dark:border-blue-900">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">
                  {cliente.nombre.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{cliente.nombre}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">ID: {cliente.id_cliente}</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Teléfono</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{cliente.telefono || 'No registrado'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{cliente.email || 'No registrado'}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Motos del Cliente */}
      <motion.div 
        variants={fadeIn} 
        initial="hidden" 
        animate="visible"
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                🏍️ Motos del Cliente
                {motos.length > 0 && (
                  <span className="ml-2 px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full">
                    {motos.length} {motos.length === 1 ? 'moto' : 'motos'}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Haz clic en una moto para ver sus servicios y bitácora
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowMotoForm(true)}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Moto
            </Button>
          </div>
          
          {isLoadingMotos ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : motos.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No hay motos registradas para este cliente
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {motos.map((moto) => (
                <div
                  key={moto.id_moto}
                  onClick={() => handleMotoClick(moto)}
                  className={`group relative p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    selectedMoto?.id_moto === moto.id_moto
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg scale-105'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:scale-102'
                  }`}
                >
                  {/* Badge de selección */}
                  {selectedMoto?.id_moto === moto.id_moto && (
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1.5 shadow-lg">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Icono de moto */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                      <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    {moto.total_servicios > 0 && (
                      <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                        {moto.total_servicios} {moto.total_servicios === 1 ? 'servicio' : 'servicios'}
                      </span>
                    )}
                  </div>
                  
                  {/* Información de la moto */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {moto.marca} {moto.modelo}
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Año: <span className="font-medium ml-1">{moto.anio}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Placa: <span className="font-medium ml-1">{moto.placa}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Indicador de click */}
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Haz clic para ver servicios</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Servicios de la Moto Seleccionada */}
      {selectedMoto && (
        <motion.div 
          variants={fadeIn} 
          initial="hidden" 
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  🔧 Servicios
                  <span className="ml-2 px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                    {selectedMoto.marca} {selectedMoto.modelo} ({selectedMoto.placa})
                  </span>
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Haz clic en "📋 Bitácora" para ver el registro detallado con fotos
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowServicioForm(true)}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Registrar Servicio
              </Button>
            </div>
            
            {isLoadingServicios ? (
              <div className="flex justify-center py-8">
                <Loader />
              </div>
            ) : servicios.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay servicios registrados para esta moto
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tipo de Servicio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Costo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {servicios.map((servicio) => (
                      <tr key={servicio.id_servicio} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {formatDate(servicio.fecha_servicio)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {servicio.tipo_servicio}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {servicio.descripcion || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(servicio.costo)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setServicioConBitacora({ servicio, moto: selectedMoto })}
                            className="inline-flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            📋 Bitácora
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Historial de Órdenes de Venta */}
      <motion.div 
        variants={fadeIn} 
        initial="hidden" 
        animate="visible"
        transition={{ delay: 0.4 }}
      >
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📦 Historial de Órdenes de Venta
          </h3>
          
          {isLoadingOrdenes ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : ordenes.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No hay órdenes de venta registradas para este cliente
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Número de Orden
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {ordenes.map((orden) => (
                    <tr 
                      key={orden.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      onClick={() => {
                        // Navigate to orden detail - will be implemented later
                        console.log('Navigate to orden:', orden.id)
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {orden.numero_orden}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(orden.fecha)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getEstadoBadgeVariant(orden.estado)}>
                          {orden.estado}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(orden.total)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Modales */}
      <MotoForm
        isOpen={showMotoForm}
        onClose={() => setShowMotoForm(false)}
        onSubmit={handleAddMoto}
        clienteId={cliente?.id_cliente}
      />

      <ServicioMotoForm
        isOpen={showServicioForm}
        onClose={() => setShowServicioForm(false)}
        onSubmit={handleAddServicio}
        motoId={selectedMoto?.id_moto}
      />

      {/* Modal de Bitácora */}
      {servicioConBitacora && (
        <ServicioConBitacora
          servicio={servicioConBitacora.servicio}
          moto={servicioConBitacora.moto}
          onClose={() => setServicioConBitacora(null)}
        />
      )}
    </div>
  )
}

export default ClienteDetalle
