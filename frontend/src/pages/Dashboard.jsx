import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useProductos } from '../hooks/useProductos'
import { useClientes } from '../hooks/useClientes'
import { useProveedores } from '../hooks/useProveedores'
import { useOrdenesVenta } from '../hooks/useOrdenesVenta'
import { useOrdenesCompra } from '../hooks/useOrdenesCompra'
import StatCard from '../components/ui/StatCard'
import { staggerContainer } from '../utils/animations'

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Bienvenido a Inventrix - Sistema de Gestión de Inventario</p>
      </div>

      {/* Welcome Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl shadow-lg p-8 text-white"
      >
        <h2 className="text-2xl font-bold mb-2">¡Bienvenido!</h2>
        <p className="text-primary-100">
          Sistema de gestión de inventario completo para tu negocio
        </p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <Link to="/productos">
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

        <Link to="/clientes">
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

        <Link to="/proveedores">
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

        <Link to="/ventas">
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

        <Link to="/ordenes-compra">
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

        <Link to="/reportes">
          <StatCard
            title="Reportes"
            value="📊"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            color="pink"
            subtitle="Generar reportes"
          />
        </Link>
      </motion.div>
    </div>
  )
}

export default Dashboard
