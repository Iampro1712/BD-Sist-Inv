import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

/**
 * Utilidades para exportar reportes a diferentes formatos
 */

// Datos del negocio
const NEGOCIO = {
  nombre: 'JC Motoshop',
  ruc: '0814198500023-4',
}

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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escribe encabezado del negocio (nombre + RUC) en un doc jsPDF.
 * Retorna la coordenada Y donde termina el encabezado.
 * @param {jsPDF} doc
 * @returns {number}
 */
const _encabezadoPDF = (doc) => {
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text(NEGOCIO.nombre, 14, 14)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.text(`RUC: ${NEGOCIO.ruc}`, 14, 20)
  doc.setLineWidth(0.3)
  doc.line(14, 23, 196, 23)
  return 28
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS EXCEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aplica estilos al encabezado de columnas de una hoja ExcelJS.
 * @param {ExcelJS.Row} headerRow
 * @param {string} hexColor - Color de fondo sin '#', e.g. '3B82F6'
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
 * Aplica bordes a una fila de datos ExcelJS.
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
 * Descarga un Workbook de ExcelJS como archivo .xlsx en el navegador.
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

/**
 * Inserta las filas de encabezado del negocio, título, fecha, período y
 * resumen opcional en una hoja ExcelJS. Debe llamarse ANTES de agregar los
 * encabezados de columna y los datos.
 *
 * @param {ExcelJS.Worksheet} ws
 * @param {number}            numCols  - Número de columnas (para merge)
 * @param {string}            titulo   - Título del reporte
 * @param {object}            [opts]
 * @param {object}            [opts.filtros]   - { fecha_inicio, fecha_fin }
 * @param {Array}             [opts.resumen]   - [{ label, valor }, ...]
 */
const _encabezadoExcel = (ws, numCols, titulo, opts = {}) => {
  const { filtros, resumen } = opts
  const lastCol = String.fromCharCode(64 + numCols)

  /** Agrega una fila con la celda A mergeada hasta lastCol y aplica fuente. */
  const addMerged = (value, font = {}) => {
    const rowIdx = ws.rowCount + 1
    ws.addRow([value])
    ws.mergeCells(`A${rowIdx}:${lastCol}${rowIdx}`)
    const cell = ws.getCell(`A${rowIdx}`)
    cell.value = value
    cell.font = font
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  }

  // Nombre del negocio
  addMerged(NEGOCIO.nombre, { bold: true, size: 14 })
  // RUC
  addMerged(`RUC: ${NEGOCIO.ruc}`, { size: 10 })
  // Separador
  ws.addRow([])
  // Título del reporte
  addMerged(titulo, { bold: true, size: 13 })
  // Fecha de generación
  addMerged(`Fecha de generación: ${formatDate()}`, { size: 10 })
  // Período (opcional)
  if (filtros?.fecha_inicio && filtros?.fecha_fin) {
    addMerged(`Período: ${filtros.fecha_inicio} – ${filtros.fecha_fin}`, { size: 10 })
  }
  // Resumen (opcional)
  if (resumen?.length) {
    ws.addRow([])
    addMerged('Resumen', { bold: true, size: 11 })
    resumen.forEach(({ label, valor }) => {
      const row = ws.addRow([`${label}:`, valor])
      row.getCell(1).font = { bold: true, size: 10 }
      row.getCell(2).font = { size: 10 }
    })
  }
  // Fila vacía antes del encabezado de columnas
  ws.addRow([])
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIONES A PDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exportar reporte de inventario a PDF
 */
export const exportarInventarioPDF = (reporte) => {
  const doc = new jsPDF()
  let y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Reporte de Inventario', 14, y + 6)
  doc.setFont(undefined, 'normal')

  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, y + 14)

  doc.setFontSize(12)
  doc.text('Resumen', 14, y + 24)
  doc.setFontSize(10)
  doc.text(`Total Productos: ${reporte.total_productos}`, 14, y + 31)
  doc.text(`Valor Total: ${formatCurrency(reporte.valor_total)}`, 14, y + 38)
  doc.text(`Productos con Stock Bajo: ${reporte.productos_stock_bajo}`, 14, y + 45)
  doc.text(`Productos Sin Stock: ${reporte.productos_sin_stock}`, 14, y + 52)

  const tableData = reporte.productos?.map((p) => [
    p.codigo,
    p.nombre,
    p.stock_actual,
    formatCurrency(p.precio_venta),
    formatCurrency(p.valor_stock),
  ])

  autoTable(doc, {
    startY: y + 60,
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
  let y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Reporte de Ventas', 14, y + 6)
  doc.setFont(undefined, 'normal')

  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, y + 14)
  doc.text(`Período: ${filtros.fecha_inicio} a ${filtros.fecha_fin}`, 14, y + 21)

  doc.setFontSize(12)
  doc.text('Resumen', 14, y + 31)
  doc.setFontSize(10)
  doc.text(`Total Ventas: ${formatCurrency(reporte.total_ventas)}`, 14, y + 38)
  doc.text(`Número de Órdenes: ${reporte.numero_ordenes}`, 14, y + 45)
  doc.text(`Ticket Promedio: ${formatCurrency(reporte.ticket_promedio)}`, 14, y + 52)

  const tableData = reporte.ordenes?.map((o) => [
    o.numero_orden,
    o.cliente,
    o.fecha,
    formatCurrency(o.total),
    o.estado,
  ])

  autoTable(doc, {
    startY: y + 60,
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
  let y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Reporte de Compras', 14, y + 6)
  doc.setFont(undefined, 'normal')

  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, y + 14)
  doc.text(`Período: ${filtros.fecha_inicio} a ${filtros.fecha_fin}`, 14, y + 21)

  doc.setFontSize(12)
  doc.text('Resumen', 14, y + 31)
  doc.setFontSize(10)
  doc.text(`Total Compras: ${formatCurrency(reporte.total_compras)}`, 14, y + 38)
  doc.text(`Número de Órdenes: ${reporte.numero_ordenes}`, 14, y + 45)
  doc.text(`Compra Promedio: ${formatCurrency(reporte.compra_promedio)}`, 14, y + 52)

  const tableData = reporte.ordenes?.map((o) => [
    o.numero_orden,
    o.proveedor,
    o.fecha,
    formatCurrency(o.total),
    o.estado,
  ])

  autoTable(doc, {
    startY: y + 60,
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
  let y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Productos Más Vendidos', 14, y + 6)
  doc.setFont(undefined, 'normal')

  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDate()}`, 14, y + 14)
  doc.text(`Período: ${filtros.fecha_inicio} a ${filtros.fecha_fin}`, 14, y + 21)

  const tableData = productos?.map((p, index) => [
    `#${index + 1}`,
    p.producto,
    p.cantidad_vendida,
    formatCurrency(p.total_ventas),
  ])

  autoTable(doc, {
    startY: y + 30,
    head: [['Posición', 'Producto', 'Cantidad Vendida', 'Total Ventas']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [139, 92, 246] },
  })

  doc.save(`reporte-productos-mas-vendidos-${Date.now()}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIONES A EXCEL  (usando ExcelJS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exportar reporte de inventario a Excel
 */
export const exportarInventarioCSV = async (reporte) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Inventario')

  ws.columns = [
    { key: 'Código',       width: 14 },
    { key: 'Producto',     width: 32 },
    { key: 'Stock',        width: 12 },
    { key: 'Stock Mínimo', width: 16 },
    { key: 'Precio Venta', width: 18 },
    { key: 'Valor Stock',  width: 18 },
  ]

  _encabezadoExcel(ws, 6, 'Reporte de Inventario', {
    resumen: [
      { label: 'Total Productos',          valor: reporte.total_productos },
      { label: 'Valor Total',              valor: formatCurrency(reporte.valor_total) },
      { label: 'Productos con Stock Bajo', valor: reporte.productos_stock_bajo },
      { label: 'Productos Sin Stock',      valor: reporte.productos_sin_stock },
    ],
  })

  const headerRow = ws.addRow(['Código', 'Producto', 'Stock', 'Stock Mínimo', 'Precio Venta', 'Valor Stock'])
  _estilarEncabezado(headerRow, '3B82F6')

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
export const exportarVentasCSV = async (reporte, filtros) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Ventas')

  ws.columns = [
    { key: 'Orden',   width: 16 },
    { key: 'Cliente', width: 32 },
    { key: 'Fecha',   width: 14 },
    { key: 'Total',   width: 18 },
    { key: 'Estado',  width: 14 },
  ]

  _encabezadoExcel(ws, 5, 'Reporte de Ventas', {
    filtros,
    resumen: [
      { label: 'Total Ventas',       valor: formatCurrency(reporte.total_ventas) },
      { label: 'Número de Órdenes',  valor: reporte.numero_ordenes },
      { label: 'Ticket Promedio',    valor: formatCurrency(reporte.ticket_promedio) },
    ],
  })

  const headerRow = ws.addRow(['Orden', 'Cliente', 'Fecha', 'Total', 'Estado'])
  _estilarEncabezado(headerRow, '10B981')

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
export const exportarComprasCSV = async (reporte, filtros) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Compras')

  ws.columns = [
    { key: 'Orden',     width: 16 },
    { key: 'Proveedor', width: 32 },
    { key: 'Fecha',     width: 14 },
    { key: 'Total',     width: 18 },
    { key: 'Estado',    width: 14 },
  ]

  _encabezadoExcel(ws, 5, 'Reporte de Compras', {
    filtros,
    resumen: [
      { label: 'Total Compras',      valor: formatCurrency(reporte.total_compras) },
      { label: 'Número de Órdenes',  valor: reporte.numero_ordenes },
      { label: 'Compra Promedio',    valor: formatCurrency(reporte.compra_promedio) },
    ],
  })

  const headerRow = ws.addRow(['Orden', 'Proveedor', 'Fecha', 'Total', 'Estado'])
  _estilarEncabezado(headerRow, '3B82F6')

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
export const exportarProductosCSV = async (productos, filtros) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Productos Más Vendidos')

  ws.columns = [
    { key: 'Posición',         width: 14 },
    { key: 'Producto',         width: 38 },
    { key: 'Cantidad Vendida', width: 20 },
    { key: 'Total Ventas',     width: 20 },
  ]

  _encabezadoExcel(ws, 4, 'Productos Más Vendidos', { filtros })

  const headerRow = ws.addRow(['Posición', 'Producto', 'Cantidad Vendida', 'Total Ventas'])
  _estilarEncabezado(headerRow, '8B5CF6')

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
