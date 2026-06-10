import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useClientes, useCreateCliente, useUpdateCliente, useDeleteCliente, useCliente, useClienteOrdenes } from '../hooks/useClientes'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import SearchBar from '../components/forms/SearchBar'
import ClienteForm from '../components/forms/ClienteForm'
import ClienteDetalle from '../components/clientes/ClienteDetalle'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Button, Loader, Card } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const Clientes = () => {
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [selectedClienteId, setSelectedClienteId] = useState(null)
  const [clienteToDelete, setClienteToDelete] = useState(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const debouncedSearch = useDebounce(search, 500)
  const toast = useToast()

  const { data, isLoading, error } = useClientes({
    search: debouncedSearch,
    ordering: ordering || undefined,
    page,
  })

  const createMutation = useCreateCliente()
  const updateMutation = useUpdateCliente()
  const deleteMutation = useDeleteCliente()

  const { data: clienteDetalle } = useCliente(selectedClienteId)
  const { data: ordenes, isLoading: isLoadingOrdenes } = useClienteOrdenes(selectedClienteId)

  const clientes = data?.results || []
  const totalPages = data?.count ? Math.ceil(data.count / 20) : 1

  // Detectar parámetro 'id' en la URL y abrir modal automáticamente
  useEffect(() => {
    const clienteId = searchParams.get('id')
    if (clienteId && !isDetalleModalOpen) {
      setSelectedClienteId(parseInt(clienteId))
      setIsDetalleModalOpen(true)
      // Limpiar el parámetro de la URL
      setSearchParams({})
    }
  }, [searchParams, isDetalleModalOpen, setSearchParams])

  const handleOpenModal = (cliente = null) => {
    setSelectedCliente(cliente)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCliente(null)
  }

  const handleOpenDetalle = (clienteId) => {
    setSelectedClienteId(clienteId)
    setIsDetalleModalOpen(true)
  }

  const handleCloseDetalle = () => {
    setIsDetalleModalOpen(false)
    setSelectedClienteId(null)
  }

  const handleSubmit = async (formData) => {
    try {
      if (selectedCliente) {
        await updateMutation.mutateAsync({ id: selectedCliente.id_cliente, data: formData })
        handleCloseModal()
        toast.success('Cliente actualizado exitosamente')
      } else {
        await createMutation.mutateAsync(formData)
        handleCloseModal()
        toast.success('Cliente creado exitosamente')
      }
    } catch (error) {
      console.error('Error al guardar cliente:', error)
      toast.error(error.response?.data?.message || 'Error al guardar el cliente')
    }
  }

  const handleOpenDeleteDialog = (cliente) => {
    setClienteToDelete(cliente)
    setIsDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false)
    setClienteToDelete(null)
  }

  const handleConfirmDelete = async () => {
    if (clienteToDelete) {
      try {
        await deleteMutation.mutateAsync(clienteToDelete.id_cliente)
        toast.success('Cliente eliminado exitosamente')
      } catch (error) {
        console.error('Error al eliminar cliente:', error)
        toast.error(error.response?.data?.message || 'Error al eliminar el cliente')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Gestión de clientes y contactos</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Cliente
        </Button>
      </div>

      {/* Search y filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={(val) => { setSearch(val); setPage(1) }}
              placeholder="Buscar por nombre, teléfono o email..."
            />
          </div>
          <button
            onClick={() => {
              setPage(1)
              setOrdering(prev =>
                prev === 'id_cliente' ? '-id_cliente' : prev === '-id_cliente' ? '' : 'id_cliente'
              )
            }}
            title="Ordenar por ID"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${
              ordering === 'id_cliente' || ordering === '-id_cliente'
                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={ordering === '-id_cliente'
                  ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                }
              />
            </svg>
            ID
            {ordering === 'id_cliente' && <span className="text-xs opacity-70">↑ asc</span>}
            {ordering === '-id_cliente' && <span className="text-xs opacity-70">↓ desc</span>}
          </button>
        </div>
      </Card>

      {/* Clientes Table */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">Error al cargar clientes: {error.message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : clientes.length === 0 ? (
        <Card className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay clientes</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {search
              ? 'No se encontraron clientes con los filtros aplicados'
              : 'Comienza creando un nuevo cliente'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {clientes.map((cliente) => (
                    <motion.tr
                      key={cliente.id_cliente}
                      variants={fadeIn}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-lg">
                              {cliente.nombre.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {cliente.nombre}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {cliente.id_cliente}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {cliente.telefono && (
                            <div className="flex items-center text-sm text-gray-900 dark:text-gray-300">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {cliente.telefono}
                            </div>
                          )}
                          {cliente.email && (
                            <div className="flex items-center text-sm text-gray-900 dark:text-gray-300">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {cliente.email}
                            </div>
                          )}
                          {!cliente.telefono && !cliente.email && (
                            <span className="text-sm text-gray-400 dark:text-gray-500">Sin información de contacto</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetalle(cliente.id_cliente)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            title="Ver detalle completo"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Ver Detalle
                          </button>
                          <button
                            onClick={() => handleOpenModal(cliente)}
                            className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            title="Editar cliente"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenDeleteDialog(cliente)}
                            className="inline-flex items-center p-2 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            title="Eliminar cliente"
                            disabled={deleteMutation.isPending}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Página <span className="font-medium">{page}</span> de{' '}
              <span className="font-medium">{totalPages}</span>
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Cliente */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="lg"
      >
        <ClienteForm
          cliente={selectedCliente}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      {/* Modal de Detalle */}
      <Modal
        isOpen={isDetalleModalOpen}
        onClose={handleCloseDetalle}
        title="Detalle del Cliente"
        size="xl"
      >
        {clienteDetalle && (
          <ClienteDetalle
            cliente={clienteDetalle}
            ordenes={ordenes || []}
            isLoadingOrdenes={isLoadingOrdenes}
          />
        )}
      </Modal>

      {/* Diálogo de Confirmación de Eliminación */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Eliminar Cliente"
        message={`¿Estás seguro de que deseas eliminar al cliente "${clienteToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default Clientes
