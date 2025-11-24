import api from './api'

export const categoriasService = {
  getAll: (params = {}) => {
    return api.get('/categorias/', { params })
  },

  getById: (id) => {
    return api.get(`/categorias/${id}/`)
  },

  create: (data) => {
    return api.post('/categorias/', data)
  },

  update: (id, data) => {
    return api.put(`/categorias/${id}/`, data)
  },

  delete: (id) => {
    return api.delete(`/categorias/${id}/`)
  },
}

export const marcasService = {
  getAll: (params = {}) => {
    return api.get('/marcas/', { params })
  },

  getById: (id) => {
    return api.get(`/marcas/${id}/`)
  },

  create: (data) => {
    return api.post('/marcas/', data)
  },

  update: (id, data) => {
    return api.put(`/marcas/${id}/`, data)
  },

  delete: (id) => {
    return api.delete(`/marcas/${id}/`)
  },
}
