import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useProductos } from '../hooks/useProductos'
import { useClientes } from '../hooks/useClientes'
import { useCreateOrdenVenta as useCrearVenta } from '../hooks/useOrdenesVenta'
import { useCajaActual } from '../hooks/useCaja'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import { productosService } from '../services/productos.service'
import { ordenesVentaService } from '../services/ordenes.service'
import { Button, Card, Modal } from '../components/ui'
import BarcodeScanner from '../components/pos/BarcodeScanner'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

const POS = () => {
  const [query, setQuery] = useState('')
  const [scanInput, setScanInput] = useState('')
  const [cart, setCart] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const scanRef = useRef(null)
  const toast = useToast()

  const debouncedQuery = useDebounce(query, 300)
  const { data: productosData } = useProductos({ search: debouncedQuery || undefined })
  const { data: clientesData } = useClientes()
  const { data: cajaActual } = useCajaActual()
  const crearVenta = useCrearVenta()

  const cajaAbierta = !!cajaActual

  const productos = productosData?.results || []
  const clientes = clientesData?.results || []

  // Cliente por defecto = primero disponible
  useEffect(() => {
    if (!clienteId && clientes.length) setClienteId(String(clientes[0].id_cliente))
  }, [clientes, clienteId])

  // Mantener el foco en el campo de escaneo
  useEffect(() => { scanRef.current?.focus() }, [])

  const agregarProducto = (p) => {
    if (!p) return
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.id_producto === p.id_producto)
      if (idx >= 0) {
        const upd = [...prev]
        upd[idx] = { ...upd[idx], cantidad: upd[idx].cantidad + 1 }
        return upd
      }
      return [...prev, {
        id_producto: p.id_producto,
        nombre: p.nombre,
        sku: p.sku_producto,
        precio: parseFloat(p.precio_final) || 0,
        cantidad: 1,
        stock: p.cantidad_actual,
      }]
    })
  }

  // Busca un código exacto por SKU vía API y lo agrega al carrito
  const buscarYAgregar = async (codigo) => {
    const code = String(codigo).trim()
    if (!code) return
    try {
      const res = await productosService.getAll({ search: code })
      const lista = res.data.results || res.data || []
      const exacto = lista.find((p) => String(p.sku_producto).toLowerCase() === code.toLowerCase())
      const prod = exacto || (lista.length === 1 ? lista[0] : null)
      if (prod) {
        agregarProducto(prod)
        toast.success(`${prod.nombre} agregado`)
      } else {
        toast.error(`Sin coincidencia exacta para "${code}"`)
      }
    } catch {
      toast.error('Error al buscar el producto')
    }
  }

  const handleScanKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      buscarYAgregar(scanInput)
      setScanInput('')
    }
  }

  const setCantidad = (id, delta) => {
    setCart((prev) => prev
      .map((it) => (it.id_producto === id ? { ...it, cantidad: Math.max(1, it.cantidad + delta) } : it)))
  }
  const quitar = (id) => setCart((prev) => prev.filter((it) => it.id_producto !== id))

  const total = cart.reduce((s, it) => s + it.precio * it.cantidad, 0)

  const cobrar = async () => {
    if (!cart.length) return
    if (!cajaAbierta) { toast.error('Abre la caja antes de cobrar'); return }
    if (!clienteId) { toast.error('Selecciona un cliente'); return }
    setCobrando(true)
    try {
      const payload = {
        cliente: parseInt(clienteId),
        fecha: new Date().toISOString().split('T')[0],
        total,
        detalles: cart.map((it) => ({
          producto: it.id_producto, cantidad: it.cantidad, precio_unitario: it.precio,
        })),
      }
      const res = await crearVenta.mutateAsync(payload)
      const idVenta = res.data?.id_venta
      // Marca la venta como pagada (cobro de mostrador)
      if (idVenta) {
        try {
          await ordenesVentaService.registrarPago(idVenta, { monto: total, metodo_pago: metodoPago })
        } catch { /* la venta quedó creada aunque falle el registro de pago */ }
      }
      toast.success(`Venta #${idVenta ?? ''} cobrada · ${formatCurrency(total)}`)
      setCart([])
      scanRef.current?.focus()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error al cobrar')
    } finally {
      setCobrando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Punto de Venta</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Escanea o busca productos y cobra rápido</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Columna izquierda: escaneo + búsqueda */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-4">
            <div className="flex gap-2">
              <input
                ref={scanRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={handleScanKey}
                placeholder="Escanea o escribe el código (SKU) y presiona Enter"
                className="flex-1 px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
              <Button variant="outline" onClick={() => setScannerOpen(true)} title="Escanear con cámara">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7V5a1 1 0 011-1h2m0 16H5a1 1 0 01-1-1v-2m16 0v2a1 1 0 01-1 1h-2M17 4h2a1 1 0 011 1v2M7 8v8m4-8v8m3-8v8M3 12h.01" />
                </svg>
              </Button>
            </div>
          </Card>

          {/* Búsqueda rápida */}
          <Card className="p-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto por nombre..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 mb-3"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[26rem] overflow-y-auto">
              {productos.map((p) => (
                <button
                  key={p.id_producto}
                  onClick={() => agregarProducto(p)}
                  className="text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{p.nombre}</p>
                  <p className="text-xs font-mono text-gray-400">{p.sku_producto}</p>
                  <p className="text-sm font-bold text-primary-600 dark:text-primary-400 mt-1">{formatCurrency(p.precio_final)}</p>
                  <p className="text-xs text-gray-400">Stock: {p.cantidad_actual}</p>
                  {/* Dónde ir a buscarlo, sin salir del mostrador */}
                  {p.ubicacion_codigo && (
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                      📍 {p.ubicacion_codigo}
                    </p>
                  )}
                </button>
              ))}
              {productos.length === 0 && (
                <p className="col-span-full text-sm text-gray-400 text-center py-6">Sin productos para mostrar</p>
              )}
            </div>
          </Card>
        </div>

        {/* Columna derecha: carrito */}
        <div className="lg:col-span-2">
          <Card className="p-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Carrito ({cart.length})</h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Vaciar</button>
              )}
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto mb-3">
              {cart.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Agrega productos para cobrar</p>
              ) : cart.map((it) => (
                <div key={it.id_producto} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.nombre}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(it.precio)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCantidad(it.id_producto, -1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">−</button>
                    <span className="w-6 text-center text-sm font-medium text-gray-900 dark:text-white">{it.cantidad}</span>
                    <button onClick={() => setCantidad(it.id_producto, 1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">+</button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(it.precio * it.cantidad)}</span>
                  <button onClick={() => quitar(it.id_producto)} className="text-gray-300 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Aviso: sin caja abierta no se puede cobrar */}
            {!cajaAbierta && (
              <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                No hay caja abierta.{' '}
                <Link to="/caja" className="font-medium underline">Abre la caja</Link> para poder cobrar.
              </div>
            )}

            {/* Cliente */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cliente</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Método de pago */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Método de pago</label>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</span>
            </div>

            <Button onClick={cobrar} loading={cobrando} disabled={cobrando || cart.length === 0 || !cajaAbierta} className="w-full">
              Cobrar {formatCurrency(total)}
            </Button>
          </Card>
        </div>
      </div>

      {/* Modal escáner */}
      <Modal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} title="Escanear código" size="md">
        {scannerOpen && (
          <BarcodeScanner
            onDetected={(code) => { setScannerOpen(false); buscarYAgregar(code) }}
            onError={(msg) => { toast.error(msg); setScannerOpen(false) }}
          />
        )}
      </Modal>
    </div>
  )
}

export default POS
