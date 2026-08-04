/**
 * Traduce un error de axios al texto que se le muestra al usuario.
 *
 * El backend responde siempre con la misma forma (ver
 * `api/exception_handler.py`):
 *
 *     { error: { code, message, status, details? } }
 *
 * `error` es un **objeto**, no un texto. Pasárselo tal cual a `toast.error()`
 * termina metiendo el objeto como hijo de un componente de React, que revienta
 * y hace que el ErrorBoundary deje la aplicación entera en blanco: el usuario
 * pierde lo que estaba haciendo por un error que sólo debía ser un aviso.
 *
 * `details` va primero porque es donde caen los errores de validación por campo
 * ("stock insuficiente", "el reembolso supera lo devuelto"), que le dicen a la
 * persona qué corregir. `message` es la versión genérica.
 */
export const extraerMensajeError = (err, fallback = 'Ocurrió un error') => {
  const data = err?.response?.data

  const details = data?.error?.details
  if (details && typeof details === 'object') {
    const primero = Object.values(details)[0]
    if (primero) {
      const texto = Array.isArray(primero) ? primero[0] : primero
      if (typeof texto === 'string') return texto
    }
  }

  const message = data?.error?.message
  if (typeof message === 'string') return message

  // Las vistas que devuelven `Response({'error': 'texto'})` a mano no pasan por
  // el handler, así que ahí `error` sí es una cadena. Conviven las dos formas.
  if (typeof data?.error === 'string') return data.error

  // Algunas vistas todavía responden `{'detail': ...}` sin pasar por el
  // handler (las de actualizaciones, por ejemplo).
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail

  return typeof err?.message === 'string' ? err.message : fallback
}
