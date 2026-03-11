import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useProductos } from '../hooks/useProductos'
import { useClientes } from '../hooks/useClientes'
import { useProveedores } from '../hooks/useProveedores'
import { useOrdenesVenta } from '../hooks/useOrdenesVenta'
import { useOrdenesCompra } from '../hooks/useOrdenesCompra'
import StatCard from '../components/ui/StatCard'
import Card from '../components/ui/Card'
import { staggerContainer, fadeIn } from '../utils/animations'

const Dashboard = () => {
  const { data: productosData } = useProductos()
  const { data: clientesData } = useClientes()
  const { data: proveedoresData } = useProveedores()
  const { data: ventasData } = useOrdenesVenta()
  const { data: comprasData } = useOrdenesCompra()

  const totalProductos = productosData?.count || 0
  const totalClientes = clientesData?.count || 0
  const totalProveedores = proveedoresData?.count || 0
  const totalVentas = ventasData?.count || 0
  const totalCompras = comprasData?.count || 0
  
  // Productos con stock bajo
  const productosStockBajo = productosData?.results?.filter(
    p => p.cantidad_actual <= p.cantidad_minima
  ) || []

  const quickActions = [
    {
      title: 'Nueva Venta',
      description: 'Registrar orden de venta',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      link: '/ventas',
      color: 'from-green-500 to-emerald-600',
    },
    {
      title: 'Nueva Compra',
      description: 'Registrar orden de compra',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      link: '/ordenes-compra',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Nuevo Cliente',
      description: 'Agregar cliente',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      link: '/clientes',
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Ver Reportes',
      description: 'Análisis y estadísticas',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      link: '/reportes',
      color: 'from-orange-500 to-red-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Resumen general de tu negocio
        </p>
      </div>

      {/* Welcome Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 rounded-2xl shadow-xl p-8 text-white"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">¡Bienvenido a Inventrix!</h2>
              <p className="text-primary-100 text-lg">
                Sistema completo de gestión de inventario y servicios
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">
                    {new Date().toLocaleDateString('es-NI', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <svg className="w-32 h-32 opacity-20" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl"></div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <Link to="/productos" className="transform transition-transform hover:scale-105">
          <StatCard
            title="Productos"
            value={totalProductos}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            color="blue"
            subtitle="Total en inventario"
          />
        </Link>

        <Link to="/clientes" className="transform transition-transform hover:scale-105">
          <StatCard
            title="Clientes"
            value={totalClientes}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            color="green"
            subtitle="Clientes registrados"
          />
        </Link>

        <Link to="/proveedores" className="transform transition-transform hover:scale-105">
          <StatCard
            title="Proveedores"
            value={totalProveedores}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            color="purple"
            subtitle="Proveedores activos"
          />
        </Link>

        <Link to="/ventas" className="transform transition-transform hover:scale-105">
          <StatCard
            title="Ventas"
            value={totalVentas}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
            color="orange"
            subtitle="Órdenes de venta"
          />
        </Link>

        <Link to="/ordenes-compra" className="transform transition-transform hover:scale-105">
          <StatCard
            title="Compras"
            value={totalCompras}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            color="indigo"
            subtitle="Órdenes de compra"
          />
        </Link>

        <Link to="/reportes" className="transform transition-transform hover:scale-105">
          <StatCard
            title="Reportes"
            value="📊"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            color="pink"
            subtitle="Análisis y estadísticas"
          />
        </Link>
      </motion.div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Acciones Rápidas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action, index) => (
                <Link
                  key={index}
                  to={action.link}
                  className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br hover:shadow-lg transition-all duration-200 hover:scale-105"
                  style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
                  <div className="relative z-10 flex items-start text-white">
                    <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      {action.icon}
                    </div>
                    <div className="ml-3">
                      <h4 className="font-semibold text-lg">{action.title}</h4>
                      <p className="text-sm text-white/80">{action.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Alerts */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible">
          <Card className="p-6 h-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Alertas
            </h3>
            <div className="space-y-3">
              {productosStockBajo.length > 0 ? (
                <>
                  <Link
                    to="/productos?bajo_stock=true"
                    className="block p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                  >
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Stock Bajo
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          {productosStockBajo.length} {productosStockBajo.length === 1 ? 'producto' : 'productos'} con stock bajo
                        </p>
                      </div>
                    </div>
                  </Link>
                </>
              ) : (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="ml-3 text-sm text-green-800 dark:text-green-200">
                      Todo en orden
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
