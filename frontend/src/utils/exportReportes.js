import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

/**
 * Utilidades para exportar reportes a diferentes formatos
 */

// Formatear moneda
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
  }).format(value || 0)
}

// Formatear fecha
const formatDate = () => {
  return new Date().toLocaleDateString('es-NI', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Exportar reporte de inventario a PDF
 */
export const exportarInventarioPDF = (reporte) => {
  const doc = new jsPDF()

  // Título
  doc.setFontSize(18)
  doc.text('Reporte de Inventario', 14, 20)

  // Fecha
  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, 28)

  // Resumen
  doc.setFontSize(12)
  doc.text('Resumen', 14, 38)
  doc.setFontSize(10)
  doc.text(`Total Productos: ${reporte.total_productos}`, 14, 45)
  doc.text(`Valor Total: ${formatCurrency(reporte.valor_total)}`, 14, 52)
  doc.text(`Productos con Stock Bajo: ${reporte.productos_stock_bajo}`, 14, 59)
  doc.text(`Productos Sin Stock: ${reporte.productos_sin_stock}`, 14, 66)

  // Tabla de productos
  const tableData = reporte.productos?.map((p) => [
    p.codigo,
    p.nombre,
    p.stock_actual,
    formatCurrency(p.precio_venta),
    formatCurrency(p.valor_stock),
  ])

  autoTable(doc, {
    startY: 75,
    head: [['Código', 'Producto', 'Stock', 'Precio', 'Valor']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  doc.save(`reporte-inventario-${Date.now()}.pdf`)
}

/**
 * Exportar reporte de ventas a PDF
 */
export const exportarVentasPDF = (reporte, filtros) => {
  const doc = new jsPDF()

  // Título
  doc.setFontSize(18)
  doc.text('Reporte de Ventas', 14, 20)

  // Fecha y filtros
  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, 28)
  doc.text(`Período: ${filtros.fecha_inicio} a ${filtros.fecha_fin}`, 14, 35)

  // Resumen
  doc.setFontSize(12)
  doc.text('Resumen', 14, 45)
  doc.setFontSize(10)
  doc.text(`Total Ventas: ${formatCurrency(reporte.total_ventas)}`, 14, 52)
  doc.text(`Número de Órdenes: ${reporte.numero_ordenes}`, 14, 59)
  doc.text(`Ticket Promedio: ${formatCurrency(reporte.ticket_promedio)}`, 14, 66)

  // Tabla de órdenes
  const tableData = reporte.ordenes?.map((o) => [
    o.numero_orden,
    o.cliente,
    o.fecha,
    formatCurrency(o.total),
    o.estado,
  ])

  autoTable(doc, {
    startY: 75,
    head: [['Orden', 'Cliente', 'Fecha', 'Total', 'Estado']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  })

  doc.save(`reporte-ventas-${Date.now()}.pdf`)
}

/**
 * Exportar reporte de compras a PDF
 */
export const exportarComprasPDF = (reporte, filtros) => {
  const doc = new jsPDF()

  // Título
  doc.setFontSize(18)
  doc.text('Reporte de Compras', 14, 20)

  // Fecha y filtros
  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, 28)
  doc.text(`Período: ${filtros.fecha_inicio} a ${filtros.fecha_fin}`, 14, 35)

  // Resumen
  doc.setFontSize(12)
  doc.text('Resumen', 14, 45)
  doc.setFontSize(10)
  doc.text(`Total Compras: ${formatCurrency(reporte.total_compras)}`, 14, 52)
  doc.text(`Número de Órdenes: ${reporte.numero_ordenes}`, 14, 59)
  doc.text(`Compra Promedio: ${formatCurrency(reporte.compra_promedio)}`, 14, 66)

  // Tabla de órdenes
  const tableData = reporte.ordenes?.map((o) => [
    o.numero_orden,
    o.proveedor,
    o.fecha,
    formatCurrency(o.total),
    o.estado,
  ])

  autoTable(doc, {
    startY: 75,
    head: [['Orden', 'Proveedor', 'Fecha', 'Total', 'Estado']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  doc.save(`reporte-compras-${Date.now()}.pdf`)
}

/**
 * Exportar productos más vendidos a PDF
 */
export const exportarProductosPDF = (productos, filtros) => {
  const doc = new jsPDF()

  // Título
  doc.setFontSize(18)
  doc.text('Productos Más Vendidos', 14, 20)

  // Fecha y filtros
  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, 28)
  doc.text(`Período: ${filtros.fecha_inicio} a ${filtros.fecha_fin}`, 14, 35)

  // Tabla de productos
  const tableData = productos?.map((p, index) => [
    `#${index + 1}`,
    p.producto,
    p.cantidad_vendida,
    formatCurrency(p.total_ventas),
  ])

  autoTable(doc, {
    startY: 45,
    head: [['Posición', 'Producto', 'Cantidad Vendida', 'Total Ventas']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [139, 92, 246] },
  })

  doc.save(`reporte-productos-mas-vendidos-${Date.now()}.pdf`)
}

/**
 * Exportar reporte de inventario a Excel
 */
export const exportarInventarioCSV = (reporte) => {
  const data = reporte.productos?.map((p) => ({
    Código: p.codigo,
    Producto: p.nombre,
    Stock: p.stock_actual,
    'Stock Mínimo': p.stock_minimo,
    'Precio Venta': formatCurrency(p.precio_venta),
    'Valor Stock': formatCurrency(p.valor_stock),
  }))

  // Crear libro de trabajo
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')

  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 12 }, // Código
    { wch: 30 }, // Producto
    { wch: 10 }, // Stock
    { wch: 15 }, // Stock Mínimo
    { wch: 15 }, // Precio Venta
    { wch: 15 }, // Valor Stock
  ]
  ws['!cols'] = colWidths

  // Descargar archivo
  XLSX.writeFile(wb, `reporte-inventario-${Date.now()}.xlsx`)
}

/**
 * Exportar reporte de ventas a Excel
 */
export const exportarVentasCSV = (reporte) => {
  const data = reporte.ordenes?.map((o) => ({
    Orden: o.numero_orden,
    Cliente: o.cliente,
    Fecha: o.fecha,
    Total: formatCurrency(o.total),
    Estado: o.estado,
  }))

  // Crear libro de trabajo
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 15 }, // Orden
    { wch: 30 }, // Cliente
    { wch: 12 }, // Fecha
    { wch: 15 }, // Total
    { wch: 12 }, // Estado
  ]
  ws['!cols'] = colWidths

  // Descargar archivo
  XLSX.writeFile(wb, `reporte-ventas-${Date.now()}.xlsx`)
}

/**
 * Exportar reporte de compras a Excel
 */
export const exportarComprasCSV = (reporte) => {
  const data = reporte.ordenes?.map((o) => ({
    Orden: o.numero_orden,
    Proveedor: o.proveedor,
    Fecha: o.fecha,
    Total: formatCurrency(o.total),
    Estado: o.estado,
  }))

  // Crear libro de trabajo
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Compras')

  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 15 }, // Orden
    { wch: 30 }, // Proveedor
    { wch: 12 }, // Fecha
    { wch: 15 }, // Total
    { wch: 12 }, // Estado
  ]
  ws['!cols'] = colWidths

  // Descargar archivo
  XLSX.writeFile(wb, `reporte-compras-${Date.now()}.xlsx`)
}

/**
 * Exportar productos más vendidos a Excel
 */
export const exportarProductosCSV = (productos) => {
  const data = productos?.map((p, index) => ({
    Posición: `#${index + 1}`,
    Producto: p.producto,
    'Cantidad Vendida': p.cantidad_vendida,
    'Total Ventas': formatCurrency(p.total_ventas),
  }))

  // Crear libro de trabajo
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos Más Vendidos')

  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 12 }, // Posición
    { wch: 35 }, // Producto
    { wch: 18 }, // Cantidad Vendida
    { wch: 18 }, // Total Ventas
  ]
  ws['!cols'] = colWidths

  // Descargar archivo
  XLSX.writeFile(wb, `reporte-productos-mas-vendidos-${Date.now()}.xlsx`)
}
