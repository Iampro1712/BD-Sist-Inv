import { motion } from 'framer-motion'

/**
 * Componente para mostrar estados vacíos con ilustración
 */
const EmptyState = ({
  icon,
  title,
  description,
  action,
  actionLabel,
  className = '',
}) => {
  const defaultIcon = (
    <svg
      className="mx-auto h-12 w-12 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-center py-12 px-4 ${className}`}
    >
      {icon || defaultIcon}
      
      <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
      
      {description && (
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">{description}</p>
      )}
      
      {action && actionLabel && (
        <div className="mt-6">
          <button
            onClick={action}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </motion.div>
  )
}

export default EmptyState
