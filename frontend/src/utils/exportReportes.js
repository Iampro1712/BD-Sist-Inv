import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

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
 * Helper interno: Aplica estilos al encabezado de una hoja ExcelJS.
 * @param {ExcelJS.Row} headerRow - Fila de encabezado
 * @param {string} hexColor - Color de fondo (sin '#'), e.g. '3B82F6'
 */
const _estilarEncabezado = (headerRow, hexColor) => {
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${hexColor}` },
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
}

/**
 * Helper interno: Aplica bordes a una fila de datos ExcelJS.
 * @param {ExcelJS.Row} row
 */
const _estilarFila = (row) => {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    }
    cell.alignment = { vertical: 'middle' }
  })
}

/**
 * Helper interno: Descarga un Workbook de ExcelJS como archivo .xlsx en el navegador.
 * @param {ExcelJS.Workbook} wb
 * @param {string} filename
 */
const _descargarWorkbook = async (wb, filename) => {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIONES A PDF
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIONES A EXCEL  (usando ExcelJS — reemplaza xlsx)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exportar reporte de inventario a Excel
 */
export const exportarInventarioCSV = async (reporte) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Inventario')

  // Definir columnas con anchos
  ws.columns = [
    { header: 'Código',        key: 'Código',        width: 14 },
    { header: 'Producto',      key: 'Producto',      width: 32 },
    { header: 'Stock',         key: 'Stock',         width: 12 },
    { header: 'Stock Mínimo',  key: 'Stock Mínimo',  width: 16 },
    { header: 'Precio Venta',  key: 'Precio Venta',  width: 18 },
    { header: 'Valor Stock',   key: 'Valor Stock',   width: 18 },
  ]

  // Estilo del encabezado (azul primario)
  _estilarEncabezado(ws.getRow(1), '3B82F6')

  // Agregar filas de datos
  reporte.productos?.forEach((p) => {
    const row = ws.addRow({
      'Código':       p.codigo,
      'Producto':     p.nombre,
      'Stock':        p.stock_actual,
      'Stock Mínimo': p.stock_minimo,
      'Precio Venta': formatCurrency(p.precio_venta),
      'Valor Stock':  formatCurrency(p.valor_stock),
    })
    _estilarFila(row)
  })

  await _descargarWorkbook(wb, `reporte-inventario-${Date.now()}.xlsx`)
}

/**
 * Exportar reporte de ventas a Excel
 */
export const exportarVentasCSV = async (reporte) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Ventas')

  ws.columns = [
    { header: 'Orden',   key: 'Orden',   width: 16 },
    { header: 'Cliente', key: 'Cliente', width: 32 },
    { header: 'Fecha',   key: 'Fecha',   width: 14 },
    { header: 'Total',   key: 'Total',   width: 18 },
    { header: 'Estado',  key: 'Estado',  width: 14 },
  ]

  // Estilo del encabezado (verde)
  _estilarEncabezado(ws.getRow(1), '10B981')

  reporte.ordenes?.forEach((o) => {
    const row = ws.addRow({
      'Orden':   o.numero_orden,
      'Cliente': o.cliente,
      'Fecha':   o.fecha,
      'Total':   formatCurrency(o.total),
      'Estado':  o.estado,
    })
    _estilarFila(row)
  })

  await _descargarWorkbook(wb, `reporte-ventas-${Date.now()}.xlsx`)
}

/**
 * Exportar reporte de compras a Excel
 */
export const exportarComprasCSV = async (reporte) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Compras')

  ws.columns = [
    { header: 'Orden',     key: 'Orden',     width: 16 },
    { header: 'Proveedor', key: 'Proveedor', width: 32 },
    { header: 'Fecha',     key: 'Fecha',     width: 14 },
    { header: 'Total',     key: 'Total',     width: 18 },
    { header: 'Estado',    key: 'Estado',    width: 14 },
  ]

  // Estilo del encabezado (azul primario)
  _estilarEncabezado(ws.getRow(1), '3B82F6')

  reporte.ordenes?.forEach((o) => {
    const row = ws.addRow({
      'Orden':     o.numero_orden,
      'Proveedor': o.proveedor,
      'Fecha':     o.fecha,
      'Total':     formatCurrency(o.total),
      'Estado':    o.estado,
    })
    _estilarFila(row)
  })

  await _descargarWorkbook(wb, `reporte-compras-${Date.now()}.xlsx`)
}

/**
 * Exportar productos más vendidos a Excel
 */
export const exportarProductosCSV = async (productos) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Productos Más Vendidos')

  ws.columns = [
    { header: 'Posición',        key: 'Posición',        width: 14 },
    { header: 'Producto',        key: 'Producto',        width: 38 },
    { header: 'Cantidad Vendida',key: 'Cantidad Vendida',width: 20 },
    { header: 'Total Ventas',    key: 'Total Ventas',    width: 20 },
  ]

  // Estilo del encabezado (violeta secundario)
  _estilarEncabezado(ws.getRow(1), '8B5CF6')

  productos?.forEach((p, index) => {
    const row = ws.addRow({
      'Posición':         `#${index + 1}`,
      'Producto':         p.producto,
      'Cantidad Vendida': p.cantidad_vendida,
      'Total Ventas':     formatCurrency(p.total_ventas),
    })
    _estilarFila(row)
  })

  await _descargarWorkbook(wb, `reporte-productos-mas-vendidos-${Date.now()}.xlsx`)
}
