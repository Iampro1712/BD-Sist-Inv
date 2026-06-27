import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuthStore'

/** Permite el acceso solo si hay sesión; si no, redirige a /login. */
const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

export default ProtectedRoute
