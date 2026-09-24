import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import useNavLayout from '../../hooks/useNavLayout'
import BottomNav from './BottomNav'
import VersionFooter from './VersionFooter'
import { ToastContainer } from '../ui/Toast'
import useToastStore from '../../hooks/useToast'
import ScrollToTop from '../ScrollToTop'

const MainLayout = () => {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)
  const isSidebar = useNavLayout((s) => s.layout) === 'sidebar'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Scroll to top on route change */}
      <ScrollToTop />
      
      {/* Barra lateral (solo xl+; en pantallas menores rige el cajón de la Navbar) */}
      {isSidebar && <Sidebar />}

      <div className={isSidebar ? 'xl:pl-64' : ''}>
      {/* Navbar */}
      <Navbar />

      {/* Main Content - Add bottom padding for mobile nav */}
      <div className="container mx-auto px-4 py-8 pb-4 lg:pb-8">
        <Outlet />
      </div>

      {/* Versión del sistema. El margen inferior en móvil deja espacio para la
          barra de navegación fija, que si no lo taparía. */}
      <div className="pb-20 lg:pb-0">
        <VersionFooter />
      </div>
      </div>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

export default MainLayout
