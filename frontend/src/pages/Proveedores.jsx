import { useState } from 'react'
import { motion } from 'framer-motion'
import { useProveedores, useCreateProveedor, useUpdateProveedor, useDeleteProveedor, useProveedor, useProveedorProductos, useProveedorOrdenes } from '../hooks/useProveedores'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import SearchBar from '../components/forms/SearchBar'
import ProveedorForm from '../components/forms/ProveedorForm'
import ProveedorDetalle from '../components/proveedores/ProveedorDetalle'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Button, Loader, Card } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const Proveedores = () => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProveedor, setSelectedProveedor] = useState(null)
  const [selectedProveedorId, setSelectedProveedorId] = useState(null)
  const [proveedorToDelete, setProveedorToDelete] = useState(null)

  const debouncedSearch = useDebounce(search, 500)
  const toast = useToast()

  const { data, isLoading, error } = useProveedores({
    search: debouncedSearch,
    page,
  })

  const createMutation = useCreateProveedor()
  const updateMutation = useUpdateProveedor()
  const deleteMutation = useDeleteProveedor()

  const { data: proveedorDetalle } = useProveedor(selectedProveedorId)
  const { data: productos, isLoading: isLoadingProductos } = useProveedorProductos(selectedProveedorId)
  const { data: ordenes, isLoading: isLoadingOrdenes } = useProveedorOrdenes(selectedProveedorId)

  const proveedores = data?.results || []
  const totalPages = data?.count ? Math.ceil(data.count / 20) : 1

  const handleOpenModal = (proveedor = null) => {
    setSelectedProveedor(proveedor)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProveedor(null)
  }

  const handleOpenDetalle = (proveedorId) => {
    setSelectedProveedorId(proveedorId)
    setIsDetalleModalOpen(true)
  }

  const handleCloseDetalle = () => {
    setIsDetalleModalOpen(false)
    setSelectedProveedorId(null)
  }

  const handleSubmit = async (formData) => {
    try {
      if (selectedProveedor) {
        await updateMutation.mutateAsync({ id: selectedProveedor.id_proveedor, data: formData })
        toast.success('Proveedor actualizado exitosamente')
      } else {
        await createMutation.mutateAsync(formData)
        toast.success('Proveedor creado exitosamente')
      }
      handleCloseModal()
    } catch (error) {
      console.error('Error al guardar proveedor:', error)
      toast.error(error.response?.data?.message || 'Error al guardar el proveedor')
    }
  }

  const handleOpenDeleteDialog = (proveedor) => {
    setProveedorToDelete(proveedor)
    setIsDeleteDialogOpen(true)
  }

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false)
    setProveedorToDelete(null)
  }

  const handleConfirmDelete = async () => {
    if (proveedorToDelete) {
      try {
        await deleteMutation.mutateAsync(proveedorToDelete.id_proveedor)
        toast.success('Proveedor eliminado exitosamente')
      } catch (error) {
        console.error('Error al eliminar proveedor:', error)
        toast.error(error.response?.data?.message || 'Error al eliminar el proveedor')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Proveedores</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Gestión de proveedores y contactos</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Proveedor
        </Button>
      </div>

      {/* Search */}
      <Card className="p-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, contacto, teléfono o email..."
        />
      </Card>

      {/* Proveedores List */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">Error al cargar proveedores: {error.message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : proveedores.length === 0 ? (
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
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay proveedores</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {search
              ? 'No se encontraron proveedores con los filtros aplicados'
              : 'Comienza creando un nuevo proveedor'}
          </p>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {proveedores.map((proveedor) => (
            <motion.div
              key={proveedor.id_proveedor}
              variants={fadeIn}
              whileHover="hover"
              initial="rest"
            >
              <Card 
                className="p-6 h-full flex flex-col cursor-pointer transition-all duration-300 hover:shadow-xl"
                onClick={() => handleOpenDetalle(proveedor.id_proveedor)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {proveedor.nombre_empresa}
                    </h3>
                    {proveedor.persona_contacto && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {proveedor.persona_contacto}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  {proveedor.telefono && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {proveedor.telefono}
                    </div>
                  )}
                  {proveedor.email && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {proveedor.email}
                    </div>
                  )}
                  {proveedor.direccion && (
                    <div className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="line-clamp-2">{proveedor.direccion}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenModal(proveedor)
                    }}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenDeleteDialog(proveedor)
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                    disabled={deleteMutation.isPending}
                  >
                    Eliminar
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
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

      {/* Modal de Proveedor */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        size="lg"
      >
        <ProveedorForm
          proveedor={selectedProveedor}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      {/* Modal de Detalle */}
      <Modal
        isOpen={isDetalleModalOpen}
        onClose={handleCloseDetalle}
        title="Detalle del Proveedor"
        size="xl"
      >
        {proveedorDetalle && (
          <ProveedorDetalle
            proveedor={proveedorDetalle}
            productos={productos || []}
            ordenes={ordenes || []}
            isLoadingProductos={isLoadingProductos}
            isLoadingOrdenes={isLoadingOrdenes}
          />
        )}
      </Modal>

      {/* Diálogo de Confirmación de Eliminación */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Eliminar Proveedor"
        message={`¿Estás seguro de que deseas eliminar al proveedor "${proveedorToDelete?.nombre_empresa}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  )
}

export default Proveedores
