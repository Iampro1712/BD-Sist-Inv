import { Badge, Loader, Card, Button } from '../ui'
import { motion } from 'framer-motion'
import { fadeIn } from '../../utils/animations'
import { useState, useEffect } from 'react'
import api from '../../services/api'
import MotoForm from '../forms/MotoForm'
import ServicioMotoForm from '../forms/ServicioMotoForm'

const ClienteDetalle = ({ cliente, ordenes = [], isLoadingOrdenes = false }) => {
  const [motos, setMotos] = useState([])
  const [isLoadingMotos, setIsLoadingMotos] = useState(false)
  const [selectedMoto, setSelectedMoto] = useState(null)
  const [servicios, setServicios] = useState([])
  const [isLoadingServicios, setIsLoadingServicios] = useState(false)
  const [showMotoForm, setShowMotoForm] = useState(false)
  const [showServicioForm, setShowServicioForm] = useState(false)

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
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información del Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nombre</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">{cliente.nombre}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Teléfono</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">{cliente.telefono || '-'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">{cliente.email || '-'}</p>
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🏍️ Motos del Cliente
            </h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowMotoForm(true)}
            >
              + Agregar Moto
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
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedMoto?.id_moto === moto.id_moto
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {moto.marca} {moto.modelo}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Año: {moto.anio}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Placa: {moto.placa}</p>
                      <div className="mt-2">
                        <Badge variant="info">
                          {moto.total_servicios || 0} servicios
                        </Badge>
                      </div>
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
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                🔧 Servicios - {selectedMoto.marca} {selectedMoto.modelo} ({selectedMoto.placa})
              </h3>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowServicioForm(true)}
              >
                + Registrar Servicio
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
    </div>
  )
}

export default ClienteDetalle
