const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    primary: 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300',
    success: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
    warning: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
    danger: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
    info: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
  }
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export default Badge
