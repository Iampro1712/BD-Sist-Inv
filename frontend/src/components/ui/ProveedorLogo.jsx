import { useMemo } from 'react'

// Logos de proveedores conocidos optimizados con Cloudinary
const PROVEEDOR_LOGOS = {
  'honda': 'https://res.cloudinary.com/ditvwxhyc/image/upload/q_auto/f_auto/c_scale,w_200/v1778609829/buy-cars-honda_b8lmvb.png',
  'kawasaki': 'https://res.cloudinary.com/ditvwxhyc/image/upload/q_auto/f_auto/c_scale,w_200/v1778609866/kawasaki-motorcycle-white-logo-png-image-701751694711211r2mmqq9gvg_lcmvfx.png',
  'yamaha': 'https://res.cloudinary.com/ditvwxhyc/image/upload/q_auto/f_auto/c_scale,w_200/v1778609919/Yamaha_Motor_Company-Logo.wine_m3cec6.png',
  'suzuki': 'https://res.cloudinary.com/ditvwxhyc/image/upload/q_auto/f_auto/c_scale,w_200/v1778609945/1280px-Suzuki_logo_2025__28vertical_29.svg.png_lmz5jn.png'
}

// Función para generar un color consistente basado en el nombre
const getColorFromName = (name) => {
  if (!name) return '#6366f1'
  
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#a855f7', // Purple
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

// Función para obtener las iniciales del nombre
const getInitials = (name) => {
  if (!name) return '?'
  
  const words = name.trim().split(/\s+/)
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase()
  }
  
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

// Componente de logo SVG genérico
const GenericLogo = ({ name, color }) => {
  const initials = getInitials(name)
  
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`gradient-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.7 }} />
        </linearGradient>
        <filter id={`shadow-${name}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
        </filter>
      </defs>
      
      {/* Fondo con gradiente */}
      <rect
        width="100"
        height="100"
        rx="20"
        fill={`url(#gradient-${name})`}
        filter={`url(#shadow-${name})`}
      />
      
      {/* Patrón decorativo */}
      <circle
        cx="80"
        cy="20"
        r="15"
        fill="white"
        opacity="0.1"
      />
      <circle
        cx="20"
        cy="80"
        r="20"
        fill="white"
        opacity="0.1"
      />
      
      {/* Iniciales */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="36"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {initials}
      </text>
    </svg>
  )
}

const ProveedorLogo = ({ nombreEmpresa, className = '', size = 'default' }) => {
  const logoUrl = useMemo(() => {
    if (!nombreEmpresa) return null
    
    const nombre = nombreEmpresa.toLowerCase()
    for (const [key, logo] of Object.entries(PROVEEDOR_LOGOS)) {
      if (nombre.includes(key)) {
        return logo
      }
    }
    return null
  }, [nombreEmpresa])
  
  const color = useMemo(() => getColorFromName(nombreEmpresa), [nombreEmpresa])
  
  // Tamaños predefinidos
  const sizeClasses = {
    small: 'w-10 h-10',
    default: 'w-16 h-16',
    large: 'w-20 h-20'
  }
  
  const sizeClass = sizeClasses[size] || className || sizeClasses.default
  
  if (logoUrl) {
    return (
      <div className={`flex-shrink-0 ${sizeClass} bg-white dark:bg-gray-800 rounded-lg p-2 flex items-center justify-center shadow-sm border border-gray-200 dark:border-gray-700`}>
        <img 
          src={logoUrl} 
          alt={`Logo ${nombreEmpresa}`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
    )
  }
  
  return (
    <div className={`flex-shrink-0 ${sizeClass} rounded-lg overflow-hidden shadow-sm`}>
      <GenericLogo name={nombreEmpresa} color={color} />
    </div>
  )
}

export default ProveedorLogo
