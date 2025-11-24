import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'

const GlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const { query, setQuery, results, isLoading, clearSearch, totalResults } = useGlobalSearch()

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atajo de teclado Ctrl+/ o Cmd+/
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }

      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleNavigate = (path) => {
    navigate(path)
    setIsOpen(false)
    clearSearch()
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  return (
    <div ref={searchRef} className="relative">
      {/* Search Button */}
      <button
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
        className="w-full flex items-center space-x-3 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="flex-1 text-left text-sm text-gray-500 dark:text-gray-400">Buscar productos, clientes, proveedores...</span>
        <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded">
          Ctrl+/
        </kbd>
      </button>

      {/* Search Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-25 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Search Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              {/* Search Input */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar productos, clientes, proveedores..."
                    className="w-full pl-10 pr-4 py-3 border-0 focus:ring-0 text-lg bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    autoComplete="off"
                  />
                  {query && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                  </div>
                )}

                {!isLoading && query && totalResults === 0 && (
                  <div className="text-center py-8">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No se encontraron resultados</p>
                  </div>
                )}

                {!isLoading && totalResults > 0 && (
                  <div className="py-2">
                    {/* Productos */}
                    {results.productos.length > 0 && (
                      <div className="mb-4">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900">
                          Productos ({results.productos.length})
                        </div>
                        {results.productos.map((producto) => (
                          <button
                            key={producto.id_producto}
                            onClick={() => handleNavigate('/productos')}
                            className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {producto.sku_producto} - {producto.nombre}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Stock: {producto.cantidad_actual}</p>
                              </div>
                              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                {formatCurrency(producto.precio_final)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Clientes */}
                    {results.clientes.length > 0 && (
                      <div className="mb-4">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900">
                          Clientes ({results.clientes.length})
                        </div>
                        {results.clientes.map((cliente) => (
                          <button
                            key={cliente.id_cliente}
                            onClick={() => handleNavigate('/clientes')}
                            className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{cliente.nombre}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {cliente.email || 'Sin email'} • {cliente.telefono || 'Sin teléfono'}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Proveedores */}
                    {results.proveedores.length > 0 && (
                      <div className="mb-4">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900">
                          Proveedores ({results.proveedores.length})
                        </div>
                        {results.proveedores.map((proveedor) => (
                          <button
                            key={proveedor.id_proveedor}
                            onClick={() => handleNavigate('/proveedores')}
                            className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{proveedor.nombre_empresa}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {proveedor.email || 'Sin email'} • {proveedor.telefono || 'Sin teléfono'}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span>
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-300">↑↓</kbd> Navegar
                  </span>
                  <span>
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-300">Enter</kbd> Seleccionar
                  </span>
                  <span>
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-300">Esc</kbd> Cerrar
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GlobalSearch
