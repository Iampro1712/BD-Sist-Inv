import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  useCategorias,
  useCreateCategoria,
  useUpdateCategoria,
  useDeleteCategoria,
} from '../hooks/useCategorias'
import { useMarcas, useCreateMarca, useUpdateMarca, useDeleteMarca } from '../hooks/useMarcas'
import { Button, Card, Loader, Badge } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'

const Categorias = () => {
  const [activeTab, setActiveTab] = useState('categorias')
  const [editingCategoria, setEditingCategoria] = useState(null)
  const [editingMarca, setEditingMarca] = useState(null)
  const [newCategoria, setNewCategoria] = useState({ nombre: '', descripcion: '' })
  const [newMarca, setNewMarca] = useState({ nombre: '', descripcion: '' })
  const [showNewCategoriaForm, setShowNewCategoriaForm] = useState(false)
  const [showNewMarcaForm, setShowNewMarcaForm] = useState(false)

  // Queries
  const { data: categoriasData, isLoading: loadingCategorias } = useCategorias()
  const { data: marcasData, isLoading: loadingMarcas } = useMarcas()

  // Mutations
  const createCategoriaMutation = useCreateCategoria()
  const updateCategoriaMutation = useUpdateCategoria()
  const deleteCategoriaMutation = useDeleteCategoria()
  const createMarcaMutation = useCreateMarca()
  const updateMarcaMutation = useUpdateMarca()
  const deleteMarcaMutation = useDeleteMarca()

  const categorias = categoriasData?.results || []
  const marcas = marcasData?.results || []

  // Handlers para Categorías
  const handleCreateCategoria = async (e) => {
    e.preventDefault()
    if (!newCategoria.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    try {
      await createCategoriaMutation.mutateAsync(newCategoria)
      setNewCategoria({ nombre: '', descripcion: '' })
      setShowNewCategoriaForm(false)
    } catch (error) {
      alert(error.response?.data?.error || 'Error al crear categoría')
    }
  }

  const handleUpdateCategoria = async (id) => {
    if (!editingCategoria.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    try {
      await updateCategoriaMutation.mutateAsync({ id, data: editingCategoria })
      setEditingCategoria(null)
    } catch (error) {
      alert(error.response?.data?.error || 'Error al actualizar categoría')
    }
  }

  const handleDeleteCategoria = async (id, nombre, productosCount) => {
    if (productosCount > 0) {
      alert(
        `No se puede eliminar la categoría "${nombre}" porque tiene ${productosCount} producto(s) asociado(s). Primero debe reasignar o eliminar los productos.`
      )
      return
    }

    if (window.confirm(`¿Está seguro de eliminar la categoría "${nombre}"?`)) {
      try {
        await deleteCategoriaMutation.mutateAsync(id)
      } catch (error) {
        alert(error.response?.data?.error || 'Error al eliminar categoría')
      }
    }
  }

  // Handlers para Marcas
  const handleCreateMarca = async (e) => {
    e.preventDefault()
    if (!newMarca.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    try {
      await createMarcaMutation.mutateAsync(newMarca)
      setNewMarca({ nombre: '', descripcion: '' })
      setShowNewMarcaForm(false)
    } catch (error) {
      alert(error.response?.data?.error || 'Error al crear marca')
    }
  }

  const handleUpdateMarca = async (id) => {
    if (!editingMarca.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    try {
      await updateMarcaMutation.mutateAsync({ id, data: editingMarca })
      setEditingMarca(null)
    } catch (error) {
      alert(error.response?.data?.error || 'Error al actualizar marca')
    }
  }

  const handleDeleteMarca = async (id, nombre, productosCount) => {
    if (productosCount > 0) {
      alert(
        `No se puede eliminar la marca "${nombre}" porque tiene ${productosCount} producto(s) asociado(s). Primero debe reasignar o eliminar los productos.`
      )
      return
    }

    if (window.confirm(`¿Está seguro de eliminar la marca "${nombre}"?`)) {
      try {
        await deleteMarcaMutation.mutateAsync(id)
      } catch (error) {
        alert(error.response?.data?.error || 'Error al eliminar marca')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Categorías y Marcas</h1>
        <p className="mt-2 text-gray-600">Gestión de categorías y marcas de productos</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('categorias')}
            className={`${
              activeTab === 'categorias'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Categorías
            {categorias.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                {categorias.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('marcas')}
            className={`${
              activeTab === 'marcas'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Marcas
            {marcas.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                {marcas.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Categorías Tab */}
      {activeTab === 'categorias' && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Categorías</h2>
              <Button onClick={() => setShowNewCategoriaForm(!showNewCategoriaForm)}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva Categoría
              </Button>
            </div>

            {/* Formulario de nueva categoría */}
            {showNewCategoriaForm && (
              <div className="p-6 bg-gray-50 border-b border-gray-200">
                <form onSubmit={handleCreateCategoria} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <input
                      type="text"
                      value={newCategoria.nombre}
                      onChange={(e) => setNewCategoria({ ...newCategoria, nombre: e.target.value })}
                      placeholder="Nombre de la categoría *"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newCategoria.descripcion}
                      onChange={(e) => setNewCategoria({ ...newCategoria, descripcion: e.target.value })}
                      placeholder="Descripción (opcional)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" loading={createCategoriaMutation.isPending}>
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowNewCategoriaForm(false)
                        setNewCategoria({ nombre: '', descripcion: '' })
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {loadingCategorias ? (
              <div className="flex justify-center py-12">
                <Loader size="lg" />
              </div>
            ) : categorias.length === 0 ? (
              <div className="p-12 text-center">
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
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay categorías</h3>
                <p className="mt-1 text-sm text-gray-500">Comienza creando una nueva categoría</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Descripción
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Productos
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categorias.map((categoria) => (
                      <motion.tr key={categoria.id} variants={fadeIn} className="hover:bg-gray-50">
                        {editingCategoria?.id === categoria.id ? (
                          <>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={editingCategoria.nombre}
                                onChange={(e) =>
                                  setEditingCategoria({ ...editingCategoria, nombre: e.target.value })
                                }
                                className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={editingCategoria.descripcion || ''}
                                onChange={(e) =>
                                  setEditingCategoria({ ...editingCategoria, descripcion: e.target.value })
                                }
                                className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="info">{categoria.productos_count || 0}</Badge>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => handleUpdateCategoria(categoria.id)}
                                className="text-green-600 hover:text-green-900"
                                disabled={updateCategoriaMutation.isPending}
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditingCategoria(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Cancelar
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {categoria.nombre}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {categoria.descripcion || '-'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="info">{categoria.productos_count || 0}</Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                              <button
                                onClick={() => setEditingCategoria(categoria)}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteCategoria(
                                    categoria.id,
                                    categoria.nombre,
                                    categoria.productos_count || 0
                                  )
                                }
                                className="text-red-600 hover:text-red-900"
                                disabled={deleteCategoriaMutation.isPending}
                              >
                                Eliminar
                              </button>
                            </td>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Marcas Tab */}
      {activeTab === 'marcas' && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Marcas</h2>
              <Button onClick={() => setShowNewMarcaForm(!showNewMarcaForm)}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva Marca
              </Button>
            </div>

            {/* Formulario de nueva marca */}
            {showNewMarcaForm && (
              <div className="p-6 bg-gray-50 border-b border-gray-200">
                <form onSubmit={handleCreateMarca} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <input
                      type="text"
                      value={newMarca.nombre}
                      onChange={(e) => setNewMarca({ ...newMarca, nombre: e.target.value })}
                      placeholder="Nombre de la marca *"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newMarca.descripcion}
                      onChange={(e) => setNewMarca({ ...newMarca, descripcion: e.target.value })}
                      placeholder="Descripción (opcional)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" loading={createMarcaMutation.isPending}>
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowNewMarcaForm(false)
                        setNewMarca({ nombre: '', descripcion: '' })
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {loadingMarcas ? (
              <div className="flex justify-center py-12">
                <Loader size="lg" />
              </div>
            ) : marcas.length === 0 ? (
              <div className="p-12 text-center">
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
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay marcas</h3>
                <p className="mt-1 text-sm text-gray-500">Comienza creando una nueva marca</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Descripción
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Productos
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {marcas.map((marca) => (
                      <motion.tr key={marca.id} variants={fadeIn} className="hover:bg-gray-50">
                        {editingMarca?.id === marca.id ? (
                          <>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={editingMarca.nombre}
                                onChange={(e) => setEditingMarca({ ...editingMarca, nombre: e.target.value })}
                                className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={editingMarca.descripcion || ''}
                                onChange={(e) =>
                                  setEditingMarca({ ...editingMarca, descripcion: e.target.value })
                                }
                                className="w-full px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="info">{marca.productos_count || 0}</Badge>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button
                                onClick={() => handleUpdateMarca(marca.id)}
                                className="text-green-600 hover:text-green-900"
                                disabled={updateMarcaMutation.isPending}
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditingMarca(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Cancelar
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {marca.nombre}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{marca.descripcion || '-'}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="info">{marca.productos_count || 0}</Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                              <button
                                onClick={() => setEditingMarca(marca)}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteMarca(marca.id, marca.nombre, marca.productos_count || 0)
                                }
                                className="text-red-600 hover:text-red-900"
                                disabled={deleteMarcaMutation.isPending}
                              >
                                Eliminar
                              </button>
                            </td>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  )
}

export default Categorias
