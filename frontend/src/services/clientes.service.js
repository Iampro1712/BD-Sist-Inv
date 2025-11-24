import api from './api'

export const clientesService = {
  getAll: (params = {}) => {
    return api.get('/clientes/', { params })
  },

  getById: (id) => {
    return api.get(`/clientes/${id}/`)
  },

  create: (data) => {
    return api.post('/clientes/', data)
  },

  update: (id, data) => {
    return api.put(`/clientes/${id}/`, data)
  },

  delete: (id) => {
    return api.delete(`/clientes/${id}/`)
  },

  getOrdenes: (id) => {
    return api.get(`/clientes/${id}/ordenes/`)
  },
}
