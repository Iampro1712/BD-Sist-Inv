/**
 * Utilidades para exportar reportes a diferentes formatos.
 *
 * jsPDF, jspdf-autotable y ExcelJS (~1.2 MB en conjunto) se importan de forma
 * dinámica y solo se descargan cuando el usuario realmente exporta, en vez de
 * inflar el bundle inicial de la página de Reportes.
 */

let _pdfLibs = null
/** Carga (una sola vez) jsPDF + autoTable bajo demanda. */
const loadPdf = async () => {
  if (!_pdfLibs) {
    const [jspdfMod, autoTableMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    _pdfLibs = { jsPDF: jspdfMod.jsPDF, autoTable: autoTableMod.default }
  }
  return _pdfLibs
}

let _ExcelJS = null
/** Carga (una sola vez) ExcelJS bajo demanda. */
const loadExcel = async () => {
  if (!_ExcelJS) {
    _ExcelJS = (await import('exceljs')).default
  }
  return _ExcelJS
}

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
export const exportarInventarioPDF = async (reporte) => {
  const { jsPDF, autoTable } = await loadPdf()
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
export const exportarVentasPDF = async (reporte, filtros) => {
  const { jsPDF, autoTable } = await loadPdf()
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
    _tipoVenta(o),
    _detalleVentaTexto(o, '\n'),
    o.fecha,
    formatCurrency(o.total),
    o.estado,
  ])

  autoTable(doc, {
    startY: y + 60,
    head: [['Orden', 'Cliente', 'Tipo', 'Productos', 'Fecha', 'Total', 'Estado']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8, cellWidth: 'wrap' },
    columnStyles: { 3: { cellWidth: 55 } },
    headStyles: { fillColor: [16, 185, 129] },
  })

  doc.save(`reporte-ventas-${Date.now()}.pdf`)
}

/**
 * Exportar reporte de compras a PDF
 */
export const exportarComprasPDF = async (reporte, filtros) => {
  const { jsPDF, autoTable } = await loadPdf()
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
export const exportarProductosPDF = async (productos, filtros) => {
  const { jsPDF, autoTable } = await loadPdf()
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
// RECIBOS / COMPROBANTES / COTIZACIONES (PDF)
// ─────────────────────────────────────────────────────────────────────────────

const _fechaCorta = (d) =>
  d ? new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/** Resume los productos de una orden como texto: "2× Llanta\n1× Aceite". */
const _resumenProductos = (productos, sep = ', ') => {
  if (!productos || !productos.length) return '—'
  return productos.map((p) => `${p.cantidad}× ${p.nombre}`).join(sep)
}

/** "Servicio" o "Producto" según el tipo de la orden de venta. */
const _tipoVenta = (o) => (o.es_servicio ? 'Servicio' : 'Producto')

/** Texto de detalle: productos, o el servicio si la orden es de servicio. */
const _detalleVentaTexto = (o, sep = ', ') => {
  if (o.productos && o.productos.length) return _resumenProductos(o.productos, sep)
  if (o.es_servicio) return `Servicio${o.tipo_servicio ? `: ${o.tipo_servicio}` : ''}`
  return '—'
}

/** Recibo de venta con detalle de productos y estado de pago. */
export const generarReciboVentaPDF = async (venta) => {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF()
  let y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Recibo de Venta', 14, y + 6)
  doc.setFont(undefined, 'normal')

  doc.setFontSize(10)
  doc.text(`N° Venta: #${venta.id_venta}`, 14, y + 14)
  doc.text(`Fecha: ${_fechaCorta(venta.fecha)}`, 14, y + 20)
  doc.text(`Cliente: ${venta.cliente_nombre || '—'}`, 14, y + 26)

  const body = (venta.productos || []).map((p) => [
    p.nombre,
    p.cantidad,
    formatCurrency(p.precio_unitario),
    formatCurrency(p.subtotal),
  ])

  autoTable(doc, {
    startY: y + 32,
    head: [['Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  })

  let fy = doc.lastAutoTable.finalY + 8
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text(`Total: ${formatCurrency(venta.total)}`, 14, fy)
  if (venta.monto_pagado !== undefined) {
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    doc.text(`Pagado: ${formatCurrency(venta.monto_pagado)}`, 14, fy + 6)
    doc.text(`Saldo pendiente: ${formatCurrency(venta.saldo_pendiente)}`, 14, fy + 12)
    doc.text(`Estado de pago: ${venta.estado_pago_display || venta.estado_pago || ''}`, 14, fy + 18)
  }

  doc.save(`recibo-venta-${venta.id_venta}.pdf`)
}

/** Comprobante de un abono / pago individual sobre una venta. */
export const generarReciboPagoPDF = async (venta, pago) => {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF()
  let y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Comprobante de Pago', 14, y + 6)
  doc.setFont(undefined, 'normal')

  doc.setFontSize(10)
  doc.text(`Recibo de pago N° ${pago.id_pago}`, 14, y + 14)
  doc.text(`Venta asociada: #${venta.id_venta}`, 14, y + 20)
  doc.text(`Cliente: ${venta.cliente_nombre || '—'}`, 14, y + 26)
  doc.text(`Fecha de pago: ${_fechaCorta(pago.fecha_pago)}`, 14, y + 32)

  autoTable(doc, {
    startY: y + 38,
    head: [['Concepto', 'Detalle']],
    body: [
      ['Monto recibido', formatCurrency(pago.monto)],
      ['Método de pago', pago.metodo_pago_display || pago.metodo_pago || '—'],
      ['Referencia', pago.referencia || '—'],
      ['Total de la venta', formatCurrency(venta.total)],
      ['Saldo pendiente', formatCurrency(venta.saldo_pendiente)],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [34, 197, 94] },
  })

  doc.save(`comprobante-pago-${pago.id_pago}.pdf`)
}

/** Cotización / proforma imprimible. */
export const generarCotizacionPDF = async (cot) => {
  // Un presupuesto de reparación necesita otro cuerpo: la moto, el diagnóstico
  // que justifica el precio, mano de obra y repuestos separados, y una firma de
  // autorización. Comparte el encabezado y los helpers con la proforma.
  if (cot.tipo === 'reparacion') return generarPresupuestoPDF(cot)

  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF()
  let y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Cotización / Proforma', 14, y + 6)
  doc.setFont(undefined, 'normal')

  doc.setFontSize(10)
  doc.text(`N° Cotización: #${cot.id_cotizacion}`, 14, y + 14)
  doc.text(`Fecha: ${_fechaCorta(cot.fecha)}`, 14, y + 20)
  doc.text(`Cliente: ${cot.cliente_nombre || '—'}`, 14, y + 26)
  doc.text(`Válida por: ${cot.validez_dias} día(s)`, 14, y + 32)

  const body = (cot.productos || []).map((p) => [
    p.nombre,
    p.cantidad,
    formatCurrency(p.precio_unitario),
    formatCurrency(p.subtotal),
  ])

  autoTable(doc, {
    startY: y + 38,
    head: [['Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [99, 102, 241] },
  })

  let fy = doc.lastAutoTable.finalY + 8
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text(`Total: ${formatCurrency(cot.total)}`, 14, fy)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text('Documento no fiscal. Precios sujetos a cambio una vez vencida la validez.', 14, fy + 8)
  doc.setTextColor(0)

  doc.save(`cotizacion-${cot.id_cotizacion}.pdf`)
}

/**
 * Presupuesto de reparación: el documento que el cliente firma para autorizar
 * el trabajo. Se llama desde generarCotizacionPDF cuando tipo === 'reparacion'.
 */
export const generarPresupuestoPDF = async (cot) => {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF()
  const y = _encabezadoPDF(doc)

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Presupuesto de reparación', 14, y + 6)
  doc.setFont(undefined, 'normal')

  // Datos en dos columnas para no estirar la hoja.
  doc.setFontSize(10)
  doc.text(`N° Presupuesto: #${cot.id_cotizacion}`, 14, y + 14)
  doc.text(`Fecha: ${_fechaCorta(cot.fecha)}`, 14, y + 20)
  doc.text(`Cliente: ${cot.cliente_nombre || '—'}`, 14, y + 26)

  const m = cot.moto_detalle
  if (m) {
    doc.text(`Moto: ${m.marca} ${m.modelo}${m.anio ? ` (${m.anio})` : ''}`, 110, y + 14)
    doc.text(`Placa: ${m.placa || '—'}`, 110, y + 20)
    if (m.km_actual) {
      doc.text(`Kilometraje: ${Number(m.km_actual).toLocaleString('es-NI')} km`, 110, y + 26)
    }
  }

  let cursor = y + 34

  // Diagnóstico: es lo que justifica el precio ante el cliente.
  if (cot.diagnostico) {
    doc.setFont(undefined, 'bold')
    doc.setFontSize(10)
    doc.text('Diagnóstico', 14, cursor)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    const lineas = doc.splitTextToSize(cot.diagnostico, 182)
    doc.text(lineas, 14, cursor + 5)
    cursor += 5 + lineas.length * 4 + 4
  }

  const manoObra = cot.servicios || []
  const repuestos = cot.productos || []

  if (manoObra.length) {
    autoTable(doc, {
      startY: cursor,
      head: [['Mano de obra', 'Cant.', 'Precio Unit.', 'Subtotal']],
      body: manoObra.map((s) => [
        s.servicio_nombre,
        s.cantidad,
        formatCurrency(s.precio_unitario),
        formatCurrency(s.subtotal),
      ]),
      foot: [['', '', 'Subtotal mano de obra', formatCurrency(cot.subtotal_mano_obra)]],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
      footStyles: { fillColor: [238, 242, 255], textColor: 40, fontStyle: 'bold' },
    })
    cursor = doc.lastAutoTable.finalY + 6
  }

  if (repuestos.length) {
    autoTable(doc, {
      startY: cursor,
      head: [['Repuestos', 'Cant.', 'Precio Unit.', 'Subtotal']],
      body: repuestos.map((p) => [
        p.nombre,
        p.cantidad,
        formatCurrency(p.precio_unitario),
        formatCurrency(p.subtotal),
      ]),
      foot: [['', '', 'Subtotal repuestos', formatCurrency(cot.subtotal_repuestos)]],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 148, 136] },
      footStyles: { fillColor: [240, 253, 250], textColor: 40, fontStyle: 'bold' },
    })
    cursor = doc.lastAutoTable.finalY + 6
  }

  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(`Total a pagar: ${formatCurrency(cot.total)}`, 14, cursor + 4)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.text(`Presupuesto válido por ${cot.validez_dias} día(s).`, 14, cursor + 11)
  cursor += 11

  if (cot.notas) {
    doc.setFontSize(9)
    const notas = doc.splitTextToSize(`Notas: ${cot.notas}`, 182)
    doc.text(notas, 14, cursor + 7)
    cursor += 7 + notas.length * 4
  }

  // Firma de autorización: sin esto el taller no empieza a trabajar.
  const firmaY = Math.min(cursor + 22, 262)
  doc.setLineWidth(0.3)
  doc.line(14, firmaY, 95, firmaY)
  doc.line(110, firmaY, 196, firmaY)
  doc.setFontSize(8)
  doc.text('Firma del cliente (autorizo la reparación)', 14, firmaY + 5)
  doc.text('Fecha', 110, firmaY + 5)

  doc.setTextColor(120)
  doc.text(
    'Documento no fiscal. Los trabajos inician una vez autorizado este presupuesto.',
    14, firmaY + 14,
  )
  doc.setTextColor(0)

  doc.save(`presupuesto-${cot.id_cotizacion}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIONES A EXCEL  (usando ExcelJS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exportar reporte de inventario a Excel
 */
export const exportarInventarioCSV = async (reporte) => {
  const ExcelJS = await loadExcel()
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
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Ventas')

  ws.columns = [
    { key: 'Orden',     width: 16 },
    { key: 'Cliente',   width: 28 },
    { key: 'Tipo',      width: 12 },
    { key: 'Productos', width: 44 },
    { key: 'Fecha',     width: 14 },
    { key: 'Total',     width: 18 },
    { key: 'Estado',    width: 14 },
  ]

  _encabezadoExcel(ws, 7, 'Reporte de Ventas', {
    filtros,
    resumen: [
      { label: 'Total Ventas',       valor: formatCurrency(reporte.total_ventas) },
      { label: 'Número de Órdenes',  valor: reporte.numero_ordenes },
      { label: 'Ticket Promedio',    valor: formatCurrency(reporte.ticket_promedio) },
    ],
  })

  const headerRow = ws.addRow(['Orden', 'Cliente', 'Tipo', 'Productos', 'Fecha', 'Total', 'Estado'])
  _estilarEncabezado(headerRow, '10B981')

  reporte.ordenes?.forEach((o) => {
    const row = ws.addRow({
      'Orden':     o.numero_orden,
      'Cliente':   o.cliente,
      'Tipo':      _tipoVenta(o),
      'Productos': _detalleVentaTexto(o, '\n'),
      'Fecha':     o.fecha,
      'Total':     formatCurrency(o.total),
      'Estado':    o.estado,
    })
    row.getCell('Productos').alignment = { wrapText: true, vertical: 'top' }
    _estilarFila(row)
  })

  await _descargarWorkbook(wb, `reporte-ventas-${Date.now()}.xlsx`)
}

/**
 * Exportar reporte de compras a Excel
 */
export const exportarComprasCSV = async (reporte, filtros) => {
  const ExcelJS = await loadExcel()
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
  const ExcelJS = await loadExcel()
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
