import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  useReporteInventario,
  useReporteVentas,
  useReporteCompras,
  useProductosMasVendidos,
} from '../hooks/useReportes'
import { useProveedores } from '../hooks/useProveedores'
import { Button, Card, Loader, Badge } from '../components/ui'
import { fadeIn, staggerContainer } from '../utils/animations'
import {
  exportarInventarioPDF,
  exportarInventarioCSV,
  exportarVentasPDF,
  exportarVentasCSV,
  exportarComprasPDF,
  exportarComprasCSV,
  exportarProductosPDF,
  exportarProductosCSV,
} from '../utils/exportReportes'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// Custom Tooltip para modo oscuro
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-gray-600 dark:text-gray-300">
            <span style={{ color: entry.color }}>{entry.name}: </span>
            <span className="font-semibold">
              {formatter ? formatter(entry.value) : entry.value}
            </span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

const Reportes = () => {
  const [tipoReporte, setTipoReporte] = useState('inventario')
  const [filtrosVentas, setFiltrosVentas] = useState({
    fecha_inicio: '',
    fecha_fin: '',
  })
  const [filtrosCompras, setFiltrosCompras] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    proveedor: '',
  })
  const [filtrosProductos, setFiltrosProductos] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    limite: 10,
  })

  // Queries
  const { data: reporteInventario, isLoading: loadingInventario } = useReporteInventario()
  const { data: reporteVentas, isLoading: loadingVentas } = useReporteVentas(
    filtrosVentas,
    tipoReporte === 'ventas' && filtrosVentas.fecha_inicio && filtrosVentas.fecha_fin
  )
  const { data: reporteCompras, isLoading: loadingCompras } = useReporteCompras(
    filtrosCompras,
    tipoReporte === 'compras' && filtrosCompras.fecha_inicio && filtrosCompras.fecha_fin
  )
  const { data: productosVendidos, isLoading: loadingProductos } = useProductosMasVendidos(
    filtrosProductos,
    tipoReporte === 'productos' && filtrosProductos.fecha_inicio && filtrosProductos.fecha_fin
  )
  const { data: proveedoresData } = useProveedores()

  const proveedores = proveedoresData?.results || []

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
    }).format(value || 0)
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const handleGenerarVentas = () => {
    if (!filtrosVentas.fecha_inicio || !filtrosVentas.fecha_fin) {
      alert('Debe seleccionar un rango de fechas')
      return
    }
    setTipoReporte('ventas')
  }

  const handleGenerarCompras = () => {
    if (!filtrosCompras.fecha_inicio || !filtrosCompras.fecha_fin) {
      alert('Debe seleccionar un rango de fechas')
      return
    }
    setTipoReporte('compras')
  }

  const handleGenerarProductos = () => {
    if (!filtrosProductos.fecha_inicio || !filtrosProductos.fecha_fin) {
      alert('Debe seleccionar un rango de fechas')
      return
    }
    setTipoReporte('productos')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reportes</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Generación y visualización de reportes del sistema</p>
      </div>

      {/* Selector de Tipo de Reporte */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Seleccionar Tipo de Reporte</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => setTipoReporte('inventario')}
            className={`p-4 rounded-lg border-2 transition-all ${
              tipoReporte === 'inventario'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white">Inventario</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Estado actual del inventario</p>
          </button>

          <button
            onClick={() => setTipoReporte('ventas')}
            className={`p-4 rounded-lg border-2 transition-all ${
              tipoReporte === 'ventas'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white">Ventas</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Análisis de ventas</p>
          </button>

          <button
            onClick={() => setTipoReporte('compras')}
            className={`p-4 rounded-lg border-2 transition-all ${
              tipoReporte === 'compras'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white">Compras</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Análisis de compras</p>
          </button>

          <button
            onClick={() => setTipoReporte('productos')}
            className={`p-4 rounded-lg border-2 transition-all ${
              tipoReporte === 'productos'
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white">Productos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Productos más vendidos</p>
          </button>
        </div>
      </Card>

      {/* Filtros según tipo de reporte */}
      {tipoReporte === 'ventas' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filtros de Ventas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Inicio <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={filtrosVentas.fecha_inicio}
                onChange={(e) => setFiltrosVentas({ ...filtrosVentas, fecha_inicio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Fin <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={filtrosVentas.fecha_fin}
                onChange={(e) => setFiltrosVentas({ ...filtrosVentas, fecha_fin: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerarVentas} className="w-full">
                Generar Reporte
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tipoReporte === 'compras' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filtros de Compras</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Inicio <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={filtrosCompras.fecha_inicio}
                onChange={(e) => setFiltrosCompras({ ...filtrosCompras, fecha_inicio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Fin <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={filtrosCompras.fecha_fin}
                onChange={(e) => setFiltrosCompras({ ...filtrosCompras, fecha_fin: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proveedor</label>
              <select
                value={filtrosCompras.proveedor}
                onChange={(e) => setFiltrosCompras({ ...filtrosCompras, proveedor: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Todos los proveedores</option>
                {proveedores.map((proveedor) => (
                  <option key={proveedor.id} value={proveedor.id}>
                    {proveedor.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerarCompras} className="w-full">
                Generar Reporte
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tipoReporte === 'productos' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filtros de Productos Más Vendidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Inicio <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={filtrosProductos.fecha_inicio}
                onChange={(e) => setFiltrosProductos({ ...filtrosProductos, fecha_inicio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Fin <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={filtrosProductos.fecha_fin}
                onChange={(e) => setFiltrosProductos({ ...filtrosProductos, fecha_fin: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Límite</label>
              <input
                type="number"
                value={filtrosProductos.limite}
                onChange={(e) => setFiltrosProductos({ ...filtrosProductos, limite: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min="1"
                max="50"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerarProductos} className="w-full">
                Generar Reporte
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Contenido del Reporte */}
      {tipoReporte === 'inventario' && (
        <>
          {loadingInventario ? (
            <div className="flex justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : reporteInventario ? (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
              {/* Resumen */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen de Inventario</h2>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarInventarioPDF(reporteInventario)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarInventarioCSV(reporteInventario)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Excel
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-transparent dark:border-blue-800">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Productos</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{reporteInventario.total_productos}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-transparent dark:border-green-800">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">Valor Total</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{formatCurrency(reporteInventario.valor_total)}</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-transparent dark:border-yellow-800">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Stock Bajo</p>
                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{reporteInventario.productos_stock_bajo}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-transparent dark:border-purple-800">
                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Sin Stock</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{reporteInventario.productos_sin_stock}</p>
                  </div>
                </div>
              </Card>

              {/* Gráfico de Distribución por Categoría */}
              {reporteInventario.por_categoria && reporteInventario.por_categoria.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribución por Categoría</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reporteInventario.por_categoria}
                        dataKey="cantidad"
                        nameKey="categoria"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {reporteInventario.por_categoria.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Tabla de Productos */}
              <Card className="overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle de Productos</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stock</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Precio</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {reporteInventario.productos?.map((producto) => (
                        <tr key={producto.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-300">
                            {producto.codigo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{producto.nombre}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">
                            {producto.stock_actual}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">
                            {formatCurrency(producto.precio_venta)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(producto.valor_stock)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {producto.stock_actual === 0 ? (
                              <Badge variant="danger">Sin Stock</Badge>
                            ) : producto.stock_actual <= producto.stock_minimo ? (
                              <Badge variant="warning">Stock Bajo</Badge>
                            ) : (
                              <Badge variant="success">Normal</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </>
      )}

      {tipoReporte === 'ventas' && reporteVentas && (
        <>
          {loadingVentas ? (
            <div className="flex justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
              {/* Resumen de Ventas */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen de Ventas</h2>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarVentasPDF(reporteVentas, filtrosVentas)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarVentasCSV(reporteVentas)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Excel
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-transparent dark:border-green-800">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Ventas</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{formatCurrency(reporteVentas.total_ventas)}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-transparent dark:border-blue-800">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Número de Órdenes</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{reporteVentas.numero_ordenes}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-transparent dark:border-purple-800">
                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Ticket Promedio</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{formatCurrency(reporteVentas.ticket_promedio)}</p>
                  </div>
                </div>
              </Card>

              {/* Gráfico de Ventas por Cliente */}
              {reporteVentas.por_cliente && reporteVentas.por_cliente.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ventas por Cliente</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reporteVentas.por_cliente}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cliente" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                      <Legend />
                      <Bar dataKey="total" fill="#10b981" name="Total Ventas" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Tabla de Órdenes */}
              <Card className="overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle de Órdenes</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Orden</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {reporteVentas.ordenes?.map((orden) => (
                        <tr key={orden.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-300">
                            {orden.numero_orden}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{orden.cliente}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{orden.fecha}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(orden.total)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <Badge variant={orden.estado === 'confirmada' ? 'success' : 'info'}>{orden.estado}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {tipoReporte === 'compras' && reporteCompras && (
        <>
          {loadingCompras ? (
            <div className="flex justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
              {/* Resumen de Compras */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen de Compras</h2>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarComprasPDF(reporteCompras, filtrosCompras)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarComprasCSV(reporteCompras)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Excel
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-transparent dark:border-blue-800">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Compras</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(reporteCompras.total_compras)}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-transparent dark:border-green-800">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">Número de Órdenes</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{reporteCompras.numero_ordenes}</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-transparent dark:border-purple-800">
                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Compra Promedio</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {formatCurrency(reporteCompras.compra_promedio)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Gráfico de Compras por Proveedor */}
              {reporteCompras.por_proveedor && reporteCompras.por_proveedor.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compras por Proveedor</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reporteCompras.por_proveedor}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="proveedor" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                      <Legend />
                      <Bar dataKey="total" fill="#3b82f6" name="Total Compras" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Tabla de Órdenes */}
              <Card className="overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle de Órdenes</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Orden</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Proveedor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {reporteCompras.ordenes?.map((orden) => (
                        <tr key={orden.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-300">
                            {orden.numero_orden}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{orden.proveedor}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{orden.fecha}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                            {formatCurrency(orden.total)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <Badge variant={orden.estado === 'recibida' ? 'success' : 'info'}>{orden.estado}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {tipoReporte === 'productos' && productosVendidos && (
        <>
          {loadingProductos ? (
            <div className="flex justify-center py-12">
              <Loader size="lg" />
            </div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
              {/* Gráfico de Productos Más Vendidos */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Productos Más Vendidos</h2>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarProductosPDF(productosVendidos, filtrosProductos)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportarProductosCSV(productosVendidos)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Excel
                    </Button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={productosVendidos} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="producto" type="category" width={150} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="cantidad_vendida" fill="#8b5cf6" name="Cantidad Vendida" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Tabla de Productos */}
              <Card className="overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Detalle de Productos</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Posición</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Cantidad Vendida
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Total Ventas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {productosVendidos.map((producto, index) => (
                        <tr key={producto.producto_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-300">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{producto.producto}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">
                            {producto.cantidad_vendida}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(producto.total_ventas)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

export default Reportes
