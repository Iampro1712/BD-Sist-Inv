import api from './api'

export const rentabilidadService = {
  rentabilidad: () => api.get('/reportes/rentabilidad/'),
  stockMuerto: (dias = 90) => api.get('/reportes/stock-muerto/', { params: { dias } }),
}
