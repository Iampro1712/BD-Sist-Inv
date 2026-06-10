import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useProductos, useProductosStockBajo } from '../hooks/useProductos'
import { useClientes } from '../hooks/useClientes'
import { useProveedores } from '../hooks/useProveedores'
import { useOrdenesVenta } from '../hooks/useOrdenesVenta'
import { useOrdenesCompra } from '../hooks/useOrdenesCompra'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.07, ease: 'easeOut' },
  }),
}

const StatBlock = ({ label, value, icon, color, to, loading, custom }) => {
  const colors = {
    blue:   { ring: 'ring-blue-100 dark:ring-blue-900/40',   icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',   num: 'text-blue-700 dark:text-blue-300' },
    green:  { ring: 'ring-green-100 dark:ring-green-900/40', icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', num: 'text-green-700 dark:text-green-300' },
    purple: { ring: 'ring-purple-100 dark:ring-purple-900/40',icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',num: 'text-purple-700 dark:text-purple-300' },
    orange: { ring: 'ring-orange-100 dark:ring-orange-900/40',icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400',num: 'text-orange-700 dark:text-orange-300' },
    indigo: { ring: 'ring-indigo-100 dark:ring-indigo-900/40',icon: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400',num: 'text-indigo-700 dark:text-indigo-300' },
  }
  const c = colors[color]

  const inner = (
    <motion.div
      custom={custom}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -3, boxShadow: '0 12px 32px -4px rgba(0,0,0,0.10)' }}
      className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 ring-2 ${c.ring} flex items-center gap-4 cursor-pointer transition-all`}
    >
      <div className={`p-3 rounded-xl shrink-0 ${c.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
        {loading
          ? <div className="h-7 w-14 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          : <p className={`text-2xl font-bold ${c.num}`}>{value}</p>
        }
      </div>
    </motion.div>
  )

  return to ? <Link to={to}>{inner}</Link> : inner
}

const QuickAction = ({ title, desc, icon, to, gradient, custom }) => (
  <motion.div custom={custom} variants={fadeUp} initial="hidden" animate="visible">
    <Link
      to={to}
      className={`group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200`}
    >
      <div className="p-2.5 bg-white/20 rounded-xl shrink-0 group-hover:bg-white/30 transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-bold text-base leading-tight">{title}</p>
        <p className="text-xs text-white/75 mt-0.5">{desc}</p>
      </div>
      <svg className="w-5 h-5 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  </motion.div>
)

const NavLink = ({ to, label, icon }) => (
  <Link
    to={to}
    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-all group"
  >
    <span className="text-gray-400 dark:text-gray-500 group-hover:text-primary-500 transition-colors">{icon}</span>
    <span className="text-sm font-medium">{label}</span>
    <svg className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </Link>
)

const Dashboard = () => {
  const { data: productosData, isLoading: loadingProductos } = useProductos()
  const { data: clientesData, isLoading: loadingClientes } = useClientes()
  const { data: proveedoresData, isLoading: loadingProveedores } = useProveedores()
  const { data: ventasData, isLoading: loadingVentas } = useOrdenesVenta()
  const { data: comprasData, isLoading: loadingCompras } = useOrdenesCompra()
  const { data: stockBajoData } = useProductosStockBajo()

  const totalProductos   = productosData?.count || 0
  const totalClientes    = clientesData?.count  || 0
  const totalProveedores = proveedoresData?.count || 0
  const totalVentas      = ventasData?.count  || 0
  const totalCompras     = comprasData?.count || 0
  const stockBajoCount   = Array.isArray(stockBajoData) ? stockBajoData.length : 0

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
  const fechaHoy = new Date().toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8 pb-8">

      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-500 to-indigo-600 p-8 text-white shadow-2xl"
      >
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-indigo-700/30 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="text-primary-200 text-sm font-medium mb-1 capitalize">{fechaHoy}</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{saludo} 👋</h1>
            <p className="mt-2 text-primary-100 text-base max-w-sm">
              Aquí tienes el resumen de tu negocio. Todo bajo control.
            </p>
          </div>

          {/* mini-resumen inline */}
          <div className="flex gap-4 shrink-0">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 text-center">
              <p className="text-2xl font-bold">{totalVentas}</p>
              <p className="text-xs text-primary-200 mt-0.5">Ventas</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 text-center">
              <p className="text-2xl font-bold">{totalClientes}</p>
              <p className="text-xs text-primary-200 mt-0.5">Clientes</p>
            </div>
            <div className={`backdrop-blur-sm rounded-2xl px-5 py-3 text-center ${stockBajoCount > 0 ? 'bg-red-500/40' : 'bg-white/15'}`}>
              <p className="text-2xl font-bold">{stockBajoCount}</p>
              <p className="text-xs text-primary-200 mt-0.5">Stock bajo</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Alerta stock bajo ────────────────────────────────────────── */}
      {stockBajoCount > 0 && (
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <Link
            to="/productos?bajo_stock=true"
            className="flex items-center gap-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group"
          >
            <div className="p-2.5 bg-red-100 dark:bg-red-900/40 rounded-xl shrink-0">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-800 dark:text-red-200">
                {stockBajoCount} {stockBajoCount === 1 ? 'producto necesita reabastecimiento' : 'productos necesitan reabastecimiento'}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Toca aquí para ver cuáles son →</p>
            </div>
            <svg className="w-5 h-5 text-red-400 group-hover:translate-x-1 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </motion.div>
      )}

      {/* ── Stats grid ───────────────────────────────────────────────── */}
      <div>
        <motion.p custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          Resumen del negocio
        </motion.p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatBlock custom={2} label="Productos" value={totalProductos} loading={loadingProductos} to="/productos" color="blue"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>}
          />
          <StatBlock custom={3} label="Clientes" value={totalClientes} loading={loadingClientes} to="/clientes" color="green"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <StatBlock custom={4} label="Proveedores" value={totalProveedores} loading={loadingProveedores} to="/proveedores" color="purple"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          />
          <StatBlock custom={5} label="Ventas" value={totalVentas} loading={loadingVentas} to="/ventas" color="orange"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
          />
          <StatBlock custom={6} label="Compras" value={totalCompras} loading={loadingCompras} to="/ordenes-compra" color="indigo"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
        </div>
      </div>

      {/* ── Bottom grid: acciones + navegación ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Acciones rápidas */}
        <div className="lg:col-span-2 space-y-4">
          <motion.p custom={7} variants={fadeUp} initial="hidden" animate="visible"
            className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            ¿Qué quieres hacer hoy?
          </motion.p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction custom={8}
              title="Registrar una venta"
              desc="Crea una nueva orden de venta"
              to="/ventas"
              gradient="from-green-500 to-emerald-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
            />
            <QuickAction custom={9}
              title="Hacer una compra"
              desc="Crea una orden de compra a proveedor"
              to="/ordenes-compra"
              gradient="from-blue-500 to-indigo-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            />
            <QuickAction custom={10}
              title="Agregar un cliente"
              desc="Registra un nuevo cliente"
              to="/clientes"
              gradient="from-purple-500 to-pink-600"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
            />
            <QuickAction custom={11}
              title="Ver reportes"
              desc="Analiza ventas y tendencias"
              to="/reportes"
              gradient="from-orange-500 to-red-500"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
          </div>
        </div>

        {/* Navegación rápida */}
        <motion.div custom={12} variants={fadeUp} initial="hidden" animate="visible">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Ir a sección</p>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
            <NavLink to="/productos" label="Productos" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            } />
            <NavLink to="/clientes" label="Clientes" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            } />
            <NavLink to="/proveedores" label="Proveedores" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            } />
            <NavLink to="/ventas" label="Ventas" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            } />
            <NavLink to="/ordenes-compra" label="Órdenes de compra" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            } />
            <NavLink to="/reportes" label="Reportes" icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            } />
          </div>
        </motion.div>

      </div>
    </div>
  )
}

export default Dashboard
