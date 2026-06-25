import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

/** Una etiqueta imprimible: nombre, código de barras (SKU) y precio. */
const BarcodeLabel = ({ producto }) => {
  const svgRef = useRef(null)

  useEffect(() => {
    const sku = producto?.sku_producto
    if (svgRef.current && sku) {
      try {
        JsBarcode(svgRef.current, String(sku), {
          format: 'CODE128',
          width: 1.3,
          height: 34,
          fontSize: 11,
          margin: 2,
          displayValue: true,
        })
      } catch {
        /* SKU no válido para CODE128: se omite el código de barras */
      }
    }
  }, [producto])

  return (
    <div className="etiqueta">
      <p className="etiqueta-nombre">{producto.nombre}</p>
      <svg ref={svgRef} className="etiqueta-barcode" />
      <p className="etiqueta-precio">{formatCurrency(producto.precio_final)}</p>
    </div>
  )
}

export default BarcodeLabel
