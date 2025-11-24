import { useState, useEffect } from 'react'
import { useDebounce } from './useDebounce'
import api from '../services/api'

export const useGlobalSearch = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({
    productos: [],
    clientes: [],
    proveedores: [],
  })
  const [isLoading, setIsLoading] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    const searchAll = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults({
          productos: [],
          clientes: [],
          proveedores: [],
        })
        return
      }

      setIsLoading(true)

      try {
        // Buscar solo en entidades que existen en la base de datos
        const [productosRes, clientesRes, proveedoresRes] = await Promise.allSettled([
          api.get('/productos/', { params: { search: debouncedQuery, page_size: 5 } }),
          api.get('/clientes/', { params: { search: debouncedQuery, page_size: 5 } }),
          api.get('/proveedores/', { params: { search: debouncedQuery, page_size: 5 } }),
        ])

        setResults({
          productos: productosRes.status === 'fulfilled' ? productosRes.value.data.results || [] : [],
          clientes: clientesRes.status === 'fulfilled' ? clientesRes.value.data.results || [] : [],
          proveedores: proveedoresRes.status === 'fulfilled' ? proveedoresRes.value.data.results || [] : [],
        })
      } catch (error) {
        console.error('Error en búsqueda global:', error)
      } finally {
        setIsLoading(false)
      }
    }

    searchAll()
  }, [debouncedQuery])

  const clearSearch = () => {
    setQuery('')
    setResults({
      productos: [],
      clientes: [],
      proveedores: [],
    })
  }

  const totalResults =
    results.productos.length +
    results.clientes.length +
    results.proveedores.length

  return {
    query,
    setQuery,
    results,
    isLoading,
    clearSearch,
    totalResults,
  }
}
