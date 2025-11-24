import { motion } from 'framer-motion'
import { scaleIn } from '../../utils/animations'

const StatCard = ({ title, value, icon, color = 'primary', subtitle, trend, loading = false }) => {
  const colorClasses = {
    primary: 'bg-primary-500 text-white',
    blue: 'bg-blue-500 text-white',
    green: 'bg-green-500 text-white',
    purple: 'bg-purple-500 text-white',
    orange: 'bg-orange-500 text-white',
    indigo: 'bg-indigo-500 text-white',
    pink: 'bg-pink-500 text-white',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    danger: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
  }

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.02, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 overflow-hidden relative border border-transparent dark:border-gray-700 cursor-pointer transition-all"
    >
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">{title}</h3>
          {icon && (
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
              {icon}
            </div>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
            {trend && (
              <p className={`text-sm mt-2 ${trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}

export default StatCard
