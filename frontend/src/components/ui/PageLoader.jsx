import { motion } from 'framer-motion'

/**
 * Loader para páginas con lazy loading
 */
const PageLoader = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Logo animado */}
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="mx-auto w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center mb-4"
        >
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </motion.div>

        {/* Texto */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-600 font-medium"
        >
          Cargando...
        </motion.p>

        {/* Barra de progreso */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mt-4 h-1 bg-primary-600 rounded-full"
          style={{ maxWidth: '200px', margin: '16px auto 0' }}
        />
      </motion.div>
    </div>
  )
}

export default PageLoader
