import { useState, useEffect } from 'react'
import api from '../services/api'

export function useBitacora(idServicio) {
  const [bitacoras, setBitacoras] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchBitacoras = async () => {
    if (!idServicio) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.get(`/bitacora/`, {
        params: { id_servicio: idServicio }
      })
      setBitacoras(response.data.results || response.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar bitácoras')
      console.error('Error fetching bitacoras:', err)
    } finally {
      setLoading(false)
    }
  }

  const crearBitacora = async (formData) => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.post('/bitacora/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      setBitacoras(prev => [response.data, ...prev])
      return response.data
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear bitácora')
      console.error('Error creating bitacora:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const eliminarImagen = async (idBitacora, imagenUrl) => {
    setLoading(true)
    setError(null)

    try {
      await api.delete(`/bitacora/${idBitacora}/eliminar_imagen/`, {
        data: { imagen_url: imagenUrl }
      })
      
      // Actualizar el estado local
      setBitacoras(prev =>
        prev.map(bitacora =>
          bitacora.id_bitacora === idBitacora
            ? {
                ...bitacora,
                imagenes: bitacora.imagenes.filter(url => url !== imagenUrl)
              }
            : bitacora
        )
      )
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar imagen')
      console.error('Error deleting image:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const eliminarBitacora = async (idBitacora) => {
    setLoading(true)
    setError(null)

    try {
      await api.delete(`/bitacora/${idBitacora}/`)
      setBitacoras(prev => prev.filter(b => b.id_bitacora !== idBitacora))
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar bitácora')
      console.error('Error deleting bitacora:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBitacoras()
  }, [idServicio])

  return {
    bitacoras,
    loading,
    error,
    crearBitacora,
    eliminarImagen,
    eliminarBitacora,
    refetch: fetchBitacoras,
  }
}
