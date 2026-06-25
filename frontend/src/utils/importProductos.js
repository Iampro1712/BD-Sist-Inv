/**
 * Parseo de archivos de productos (CSV / XLSX) para la importación masiva.
 * Las librerías pesadas (papaparse, exceljs) se importan de forma dinámica.
 */

// Mapea encabezados flexibles del archivo a los campos canónicos del backend.
const ALIASES = {
  sku_producto: ['sku', 'sku_producto', 'codigo', 'código', 'code'],
  nombre: ['nombre', 'producto', 'name', 'descripcion_producto'],
  cantidad_actual: ['cantidad', 'stock', 'cantidad_actual', 'existencia', 'existencias'],
  cantidad_minima: ['minimo', 'mínimo', 'stock_minimo', 'cantidad_minima'],
  precio_compra_unitario: ['costo', 'precio_compra', 'precio_compra_unitario', 'compra'],
  precio_final: ['precio', 'precio_venta', 'precio_final', 'venta', 'pvp'],
}

const NUMERIC = new Set([
  'cantidad_actual', 'cantidad_minima', 'precio_compra_unitario', 'precio_final',
])

const _norm = (s) => String(s || '').trim().toLowerCase()

/** Construye un mapa {headerOriginal -> campoCanonico} a partir de los encabezados. */
const _mapearEncabezados = (headers) => {
  const map = {}
  headers.forEach((h) => {
    const key = _norm(h)
    for (const [campo, alias] of Object.entries(ALIASES)) {
      if (alias.includes(key)) { map[h] = campo; break }
    }
  })
  return map
}

/** Convierte una fila cruda {header: valor} a {campoCanonico: valor} tipado. */
const _normalizarFila = (fila, headerMap) => {
  const out = {}
  for (const [header, valor] of Object.entries(fila)) {
    const campo = headerMap[header]
    if (!campo) continue
    if (NUMERIC.has(campo)) {
      const num = parseFloat(String(valor).replace(',', '.'))
      if (!Number.isNaN(num)) out[campo] = num
    } else {
      const v = String(valor ?? '').trim()
      if (v) out[campo] = v
    }
  }
  return out
}

const _parseCSV = async (file) => {
  const Papa = (await import('papaparse')).default
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields || []
        const headerMap = _mapearEncabezados(headers)
        resolve(res.data.map((f) => _normalizarFila(f, headerMap)))
      },
      error: reject,
    })
  })
}

const _parseXLSX = async (file) => {
  const ExcelJS = (await import('exceljs')).default
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return []

  // exceljs entrega row.values como array 1-indexado (índice 0 vacío)
  const headerRow = ws.getRow(1).values.slice(1).map((v) => (v == null ? '' : String(v)))
  const headerMap = _mapearEncabezados(headerRow)

  const filas = []
  ws.eachRow((row, idx) => {
    if (idx === 1) return // saltar encabezado
    const values = row.values.slice(1)
    const obj = {}
    headerRow.forEach((h, i) => { obj[h] = values[i] })
    const norm = _normalizarFila(obj, headerMap)
    if (Object.keys(norm).length) filas.push(norm)
  })
  return filas
}

/**
 * Parsea un File (CSV o XLSX) y devuelve un array de productos normalizados.
 * Cada item: { sku_producto, nombre, cantidad_actual?, cantidad_minima?,
 * precio_compra_unitario?, precio_final? }
 */
export const parseProductosFile = async (file) => {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'csv') return _parseCSV(file)
  if (ext === 'xlsx' || ext === 'xls') return _parseXLSX(file)
  throw new Error('Formato no soportado. Usa un archivo .csv o .xlsx')
}

/** Descarga una plantilla CSV de ejemplo con los encabezados esperados. */
export const descargarPlantillaProductos = () => {
  const headers = ['sku_producto', 'nombre', 'cantidad_actual', 'cantidad_minima', 'precio_compra_unitario', 'precio_final']
  const ejemplo = ['SKU-001', 'Producto de ejemplo', '10', '2', '100', '150']
  const csv = `${headers.join(',')}\n${ejemplo.join(',')}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-productos.csv'
  a.click()
  URL.revokeObjectURL(url)
}
