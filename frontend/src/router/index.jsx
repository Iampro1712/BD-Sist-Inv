import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Layout
import MainLayout from '../components/layout/MainLayout'
import PageLoader from '../components/ui/PageLoader'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import AdminRoute from '../components/auth/AdminRoute'

// Lazy load pages
const Login = lazy(() => import('../pages/Login'))
const Usuarios = lazy(() => import('../pages/Usuarios'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Productos = lazy(() => import('../pages/Productos'))
const Proveedores = lazy(() => import('../pages/Proveedores'))
const Clientes = lazy(() => import('../pages/Clientes'))
const OrdenesCompra = lazy(() => import('../pages/OrdenesCompra'))
const OrdenesVenta = lazy(() => import('../pages/OrdenesVenta'))
const Movimientos = lazy(() => import('../pages/Movimientos'))
const Reportes = lazy(() => import('../pages/Reportes'))
const Categorias = lazy(() => import('../pages/Categorias'))
const LogsAuditoria = lazy(() => import('../pages/LogsAuditoria'))
const Garantias = lazy(() => import('../pages/Garantias'))
const CuentasCobrar = lazy(() => import('../pages/CuentasCobrar'))
const CuentasPagar = lazy(() => import('../pages/CuentasPagar'))
const Cotizaciones = lazy(() => import('../pages/Cotizaciones'))
const Devoluciones = lazy(() => import('../pages/Devoluciones'))
const Respaldos = lazy(() => import('../pages/Respaldos'))
const Rentabilidad = lazy(() => import('../pages/Rentabilidad'))
const POS = lazy(() => import('../pages/POS'))
const Caja = lazy(() => import('../pages/Caja'))
const Gastos = lazy(() => import('../pages/Gastos'))
const Taller = lazy(() => import('../pages/Taller'))
const MantenimientoPreventivo = lazy(() => import('../pages/MantenimientoPreventivo'))
const Ubicaciones = lazy(() => import('../pages/Ubicaciones'))
const ConteoFisico = lazy(() => import('../pages/ConteoFisico'))
const AnalisisProveedores = lazy(() => import('../pages/AnalisisProveedores'))
const Etiquetas = lazy(() => import('../pages/Etiquetas'))
const NotFound = lazy(() => import('../pages/NotFound'))

const router = createBrowserRouter([
  {
    path: 'login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        // Guard: todas las rutas internas requieren sesión
        element: <ProtectedRoute />,
        children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'productos',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Productos />
          </Suspense>
        ),
      },
      {
        path: 'proveedores',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Proveedores />
          </Suspense>
        ),
      },
      {
        path: 'clientes',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Clientes />
          </Suspense>
        ),
      },
      {
        path: 'ordenes-compra',
        element: (
          <Suspense fallback={<PageLoader />}>
            <OrdenesCompra />
          </Suspense>
        ),
      },
      {
        path: 'ventas',
        element: (
          <Suspense fallback={<PageLoader />}>
            <OrdenesVenta />
          </Suspense>
        ),
      },
      {
        path: 'movimientos',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Movimientos />
          </Suspense>
        ),
      },
      {
        path: 'reportes',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Reportes />
          </Suspense>
        ),
      },
      {
        path: 'categorias',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Categorias />
          </Suspense>
        ),
      },
      {
        path: 'logs-auditoria',
        element: (
          <Suspense fallback={<PageLoader />}>
            <LogsAuditoria />
          </Suspense>
        ),
      },
      {
        path: 'garantias',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Garantias />
          </Suspense>
        ),
      },
      {
        path: 'cuentas-cobrar',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CuentasCobrar />
          </Suspense>
        ),
      },
      {
        path: 'cuentas-pagar',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CuentasPagar />
          </Suspense>
        ),
      },
      {
        path: 'cotizaciones',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Cotizaciones />
          </Suspense>
        ),
      },
      {
        path: 'devoluciones',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Devoluciones />
          </Suspense>
        ),
      },
      {
        path: 'respaldos',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Respaldos />
          </Suspense>
        ),
      },
      {
        path: 'rentabilidad',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Rentabilidad />
          </Suspense>
        ),
      },
      {
        path: 'pos',
        element: (
          <Suspense fallback={<PageLoader />}>
            <POS />
          </Suspense>
        ),
      },
      {
        path: 'caja',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Caja />
          </Suspense>
        ),
      },
      {
        path: 'gastos',
        element: (
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <Gastos />
            </Suspense>
          </AdminRoute>
        ),
      },
      {
        path: 'taller',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Taller />
          </Suspense>
        ),
      },
      {
        path: 'preventivo',
        element: (
          <Suspense fallback={<PageLoader />}>
            <MantenimientoPreventivo />
          </Suspense>
        ),
      },
      {
        path: 'ubicaciones',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Ubicaciones />
          </Suspense>
        ),
      },
      {
        // Los reportes que alimentan esta página son admin-only.
        path: 'analisis-proveedores',
        element: (
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <AnalisisProveedores />
            </Suspense>
          </AdminRoute>
        ),
      },
      {
        // Mueve stock: solo admin.
        path: 'conteo-fisico',
        element: (
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <ConteoFisico />
            </Suspense>
          </AdminRoute>
        ),
      },
      {
        path: 'etiquetas',
        element: (
          <Suspense fallback={<PageLoader />}>
            <Etiquetas />
          </Suspense>
        ),
      },
      {
        path: 'usuarios',
        element: (
          <AdminRoute>
            <Suspense fallback={<PageLoader />}>
              <Usuarios />
            </Suspense>
          </AdminRoute>
        ),
      },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<PageLoader />}>
        <NotFound />
      </Suspense>
    ),
  },
])

export default router
