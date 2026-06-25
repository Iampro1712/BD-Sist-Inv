import api from './api'

export const cuentasCobrarService = {
  get: () => api.get('/reportes/cuentas-por-cobrar/'),
}
