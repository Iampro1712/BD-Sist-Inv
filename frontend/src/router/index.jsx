import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Layout
import MainLayout from '../components/layout/MainLayout'
import PageLoader from '../components/ui/PageLoader'

// Lazy load pages
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Productos = lazy(() => import('../pages/Productos'))
const Proveedores = lazy(() => import('../pages/Proveedores'))
const Clientes = lazy(() => import('../pages/Clientes'))
const OrdenesCompra = lazy(() => import('../pages/OrdenesCompra'))
const OrdenesVenta = lazy(() => import('../pages/OrdenesVenta'))
const Movimientos = lazy(() => import('../pages/Movimientos'))
const Reportes = lazy(() => import('../pages/Reportes'))
const Categorias = lazy(() => import('../pages/Categorias'))
const NotFound = lazy(() => import('../pages/NotFound'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
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
