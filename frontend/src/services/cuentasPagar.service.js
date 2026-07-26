import api from './api'

export const cuentasPagarService = {
  get: () => api.get('/reportes/cuentas-por-pagar/'),
}
