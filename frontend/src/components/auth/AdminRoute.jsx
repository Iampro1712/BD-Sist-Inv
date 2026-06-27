import { Navigate } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuthStore'

/**
 * Guard de rol: solo administradores (is_staff). Los demás se redirigen a Home
 * sin renderizar el contenido protegido.
 */
const AdminRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_staff) return <Navigate to="/" replace />
  return children
}

export default AdminRoute
