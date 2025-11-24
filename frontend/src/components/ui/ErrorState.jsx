import { motion } from 'framer-motion'

/**
 * Componente para mostrar estados de error con botón de retry
 */
const ErrorState = ({
  title = 'Algo salió mal',
  message = 'Ocurrió un error al cargar los datos. Por favor, intenta nuevamente.',
  onRetry,
  retryLabel = 'Reintentar',
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`text-center py-12 px-4 ${className}`}
    >
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
        <svg
          className="h-8 w-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
      
      <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">{message}</p>

      {onRetry && (
        <div className="mt-6">
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {retryLabel}
          </button>
        </div>
      )}
    </motion.div>
  )
}

export default ErrorState
