/**
 * Componente Skeleton para estados de carga
 */
const Skeleton = ({ className = '', variant = 'text', count = 1 }) => {
  const baseClasses = 'animate-pulse bg-gray-200 rounded'

  const variants = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/4',
    circle: 'h-12 w-12 rounded-full',
    rectangle: 'h-32 w-full',
    card: 'h-48 w-full',
  }

  const skeletonClass = `${baseClasses} ${variants[variant]} ${className}`

  if (count === 1) {
    return <div className={skeletonClass} />
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={skeletonClass} />
      ))}
    </div>
  )
}

/**
 * Skeleton para tabla
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} variant="text" className="h-5" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} variant="text" />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton para card
 */
export const CardSkeleton = ({ count = 1 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <Skeleton variant="title" />
          <Skeleton variant="text" count={3} />
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton
