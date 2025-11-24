const Input = ({
  label,
  error,
  type = 'text',
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={`
          w-full px-4 py-2 border rounded-lg
          bg-white dark:bg-gray-700 
          text-gray-900 dark:text-white
          placeholder-gray-500 dark:placeholder-gray-400
          focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

export default Input
