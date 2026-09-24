import { Link, useLocation } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuthStore'
import { homeItem, getNavGroups } from './navConfig'

const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={`${className} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
)

/**
 * Menú lateral de escritorio (xl+), con todas las opciones siempre visibles
 * (sin grupos que expandir) para llegar a cualquier página en un solo clic. En pantallas menores se sigue usando el
 * cajón deslizable de la Navbar, así que este componente solo se dibuja en xl.
 */
const Sidebar = () => {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const groups = getNavGroups(!!user?.is_staff)
  const isActive = (path) => location.pathname === path

  const itemClass = (active) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`

  return (
    <aside className="hidden xl:flex flex-col fixed top-0 left-0 bottom-0 w-64 z-40 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-colors duration-200">
      <Link to="/" className="flex items-center gap-2 h-16 px-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-white" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </div>
        <span className="text-xl font-bold text-gray-900 dark:text-white">Inventrix</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Menú principal">
        <Link to={homeItem.path} className={itemClass(isActive(homeItem.path))}>
          <Icon d={homeItem.icon} />
          {homeItem.name}
        </Link>

        {groups.map((group) => (
          <div key={group.name} className="pt-3">
            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {group.name}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link key={item.path} to={item.path} className={itemClass(isActive(item.path))}>
                  <Icon d={item.icon} />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
