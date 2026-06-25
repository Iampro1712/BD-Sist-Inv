import api from './api'

export const backupService = {
  // Descarga el respaldo como blob (archivo JSON adjunto)
  descargar: () => api.get('/backup/', { responseType: 'blob' }),
}
