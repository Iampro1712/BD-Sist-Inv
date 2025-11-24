import { useState } from 'react'
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
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [selectedClienteId, setSelectedClienteId] = useState(null)
  const [clienteToDelete, setClienteToDelete] = useState(null)

  const debouncedSearch = useDebounce(search, 500)
  const toast = useToast()

  const { data, isLoading, error } = useClientes({
    search: debouncedSearch,
    page,
  })

  const createMutation = useCreateCliente()
  const updateMutation = useUpdateCliente()
  const deleteMutation = useDeleteCliente()

  const { data: clienteDetalle } = useCliente(selectedClienteId)
  const { data: ordenes, isLoading: isLoadingOrdenes } = useClienteOrdenes(selectedClienteId)

  const clientes = data?.results || []
  const totalPages = data?.count ? Math.ceil(data.count / 20) : 1

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

      {/* Search */}
      <Card className="p-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, teléfono o email..."
        />
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
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
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
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetalle(cliente.id_cliente)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {cliente.nombre}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-300">{cliente.telefono || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-300">{cliente.email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenModal(cliente)
                          }}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 mr-4"
                        >
                          Editar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDeleteDialog(cliente)
                          }}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          disabled={deleteMutation.isPending}
                        >
                          Eliminar
                        </button>
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
