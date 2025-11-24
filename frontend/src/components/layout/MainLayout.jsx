import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import BottomNav from './BottomNav'
import { ToastContainer } from '../ui/Toast'
import useToastStore from '../../hooks/useToast'

const MainLayout = () => {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Navbar */}
      <Navbar />

      {/* Main Content - Add bottom padding for mobile nav */}
      <div className="container mx-auto px-4 py-8 pb-20 lg:pb-8">
        <Outlet />
      </div>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

export default MainLayout
