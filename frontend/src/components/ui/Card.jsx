import { motion } from 'framer-motion'

const Card = ({ children, className = '', hover = false, ...props }) => {
  const baseClasses = 'bg-white dark:bg-gray-800 rounded-xl shadow-md dark:shadow-gray-900/50 overflow-hidden transition-colors duration-200'
  
  if (hover) {
    return (
      <motion.div
        whileHover={{ scale: 1.02, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
        transition={{ duration: 0.3 }}
        className={`${baseClasses} ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
  
  return (
    <div className={`${baseClasses} ${className}`} {...props}>
      {children}
    </div>
  )
}

export default Card
