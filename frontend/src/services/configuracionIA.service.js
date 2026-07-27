import api from './api'

// La clave viaja hacia el backend al guardar, pero nunca vuelve: la API
// responde con una versión enmascarada (`sk-…4f2a`). Por eso tampoco existe un
// `get` que traiga la clave, ni el navegador llama a los proveedores de IA
// directamente — eso obligaría a tener la clave acá.
export const configuracionIAService = {
  getAll: () => api.get('/configuracion-ia/'),
  // Proveedores y modelos disponibles, para poblar los selectores.
  catalogo: () => api.get('/configuracion-ia/catalogo/'),
  // Qué proveedor está activo; lo consultarán las funciones de IA.
  estado: () => api.get('/configuracion-ia/estado/'),

  // Los modelos los da el proveedor, con la clave ya guardada: por eso esto
  // cuelga de una configuración y no del catálogo.
  modelos: (id) => api.get(`/configuracion-ia/${id}/modelos/`),

  guardar: (data) => api.post('/configuracion-ia/guardar/', data),
  activar: (id) => api.post(`/configuracion-ia/${id}/activar/`),
  probar: (id) => api.post(`/configuracion-ia/${id}/probar/`),
  remove: (id) => api.delete(`/configuracion-ia/${id}/`),
}
