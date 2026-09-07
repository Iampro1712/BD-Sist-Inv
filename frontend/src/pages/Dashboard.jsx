import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useProductos, useProductosStockBajo } from '../hooks/useProductos'
import { useClientes } from '../hooks/useClientes'
import { useProveedores } from '../hooks/useProveedores'
import { useOrdenesVenta } from '../hooks/useOrdenesVenta'
import { useOrdenesCompra } from '../hooks/useOrdenesCompra'
import { useCajaActual } from '../hooks/useCaja'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: 'easeOut' },
  }),
}

// CTA grande: los dos flujos que arrancan el día a día del taller/mostrador.
const PrimaryAction = ({ title, desc, icon, to, gradient, solid, custom }) => (
  <motion.div custom={custom} variants={fadeUp} initial="hidden" animate="visible">
    <Link
      to={to}
      className={`group flex flex-col justify-between gap-8 rounded-3xl p-7 min-h-[190px] text-white shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 ${
        gradient ? `bg-gradient-to-br ${gradient}` : solid
      }`}
    >
      <div className="p-2.5 bg-white/15 rounded-xl w-fit group-hover:bg-white/25 transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-extrabold text-2xl leading-tight">{title}</p>
        <p className="text-sm text-white/75 mt-1">{desc}</p>
      </div>
    </Link>
  </motion.div>
)

// Acciones secundarias: acceso rápido a lo que sigue en frecuencia de uso.
const SecondaryAction = ({ title, icon, to, custom }) => (
  <motion.div custom={custom} variants={fadeUp} initial="hidden" animate="visible">
    <Link
      to={to}
      className="group flex flex-col justify-between gap-6 rounded-2xl p-5 min-h-[140px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <span className="text-primary-600 dark:text-primary-400">{icon}</span>
      <p className="font-bold text-sm text-gray-900 dark:text-white">{title}</p>
    </Link>
  </motion.div>
)

const Dashboard = () => {
  const { data: productosData, isLoading: loadingProductos } = useProductos()
  const { data: clientesData, isLoading: loadingClientes } = useClientes()
  const { data: proveedoresData } = useProveedores()
  const { data: ventasData } = useOrdenesVenta()
  const { data: comprasData } = useOrdenesCompra()
  const { data: stockBajoData } = useProductosStockBajo()
  const { data: cajaActual, isLoading: loadingCaja } = useCajaActual()

  const totalProductos   = productosData?.count || 0
  const totalClientes    = clientesData?.count  || 0
  const totalProveedores = proveedoresData?.count || 0
  const totalVentas      = ventasData?.count  || 0
  const totalCompras     = comprasData?.count || 0
  const stockBajoCount   = Array.isArray(stockBajoData) ? stockBajoData.length : 0
  const cajaAbierta      = !!cajaActual

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
  const fechaHoy = new Date().toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8 pb-8">

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="text-sm text-gray-500 dark:text-gray-400 capitalize"
      >
        {saludo} · {fechaHoy}
      </motion.p>

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

      {/* ── ¿Qué vas a hacer? — CTA grande + acciones secundarias ──────── */}
      <div>
        <motion.p custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          ¿Qué vas a hacer?
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-1 lg:col-span-2">
            <PrimaryAction custom={2}
              title="Vender"
              desc="Abrir el punto de venta"
              to="/pos"
              gradient="from-primary-600 to-primary-700"
              icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6" /><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>}
            />
          </div>
          <div className="sm:col-span-1 lg:col-span-2">
            <PrimaryAction custom={3}
              title="Nueva reparación"
              desc="Recibir una moto al taller"
              to="/taller"
              solid="bg-gray-900 dark:bg-gray-800 dark:border dark:border-gray-700"
              icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.5 3.5l6 6M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z" /></svg>}
            />
          </div>

          <SecondaryAction custom={4} title="Nuevo cliente" to="/clientes"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
          />
          <SecondaryAction custom={5} title="Hacer compra" to="/ordenes-compra"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7H4a1 1 0 00-1 1v9a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2 M12 11v5M9.5 13.5h5" /></svg>}
          />
          <SecondaryAction custom={6} title="Buscar producto" to="/productos"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 8v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8M3 8l2.5-4h13L21 8M3 8h18" /></svg>}
          />
          <SecondaryAction custom={7} title="Ver reportes" to="/reportes"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19h16M7 19V9m5 10V5m5 14v-7" /></svg>}
          />
        </div>
      </div>

      {/* ── Barra de estado ──────────────────────────────────────────── */}
      <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible"
        className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
          {!loadingCaja && (
            <span className={`w-2 h-2 rounded-full ${cajaAbierta ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          )}
          {loadingCaja ? 'Consultando caja…' : cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}
        </div>
        <Link to="/ventas" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          Ventas: <b className="text-gray-900 dark:text-white">{loadingProductos ? '—' : totalVentas}</b>
        </Link>
        <Link to="/productos" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          Productos: <b className="text-gray-900 dark:text-white">{loadingProductos ? '—' : totalProductos}</b>
        </Link>
        <Link to="/clientes" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          Clientes: <b className="text-gray-900 dark:text-white">{loadingClientes ? '—' : totalClientes}</b>
        </Link>
        <Link to="/proveedores" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          Proveedores: <b className="text-gray-900 dark:text-white">{totalProveedores}</b>
        </Link>
        <Link to="/ordenes-compra" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          Compras: <b className="text-gray-900 dark:text-white">{totalCompras}</b>
        </Link>
        {stockBajoCount > 0 && (
          <Link to="/productos?bajo_stock=true" className="text-sm font-bold text-red-600 dark:text-red-400 hover:underline ml-auto">
            {stockBajoCount} con stock bajo →
          </Link>
        )}
      </motion.div>

    </div>
  )
}

export default Dashboard
