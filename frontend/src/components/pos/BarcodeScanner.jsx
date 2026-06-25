import { useEffect, useRef } from 'react'

/**
 * Escáner de código de barras por cámara (lazy-load de html5-qrcode).
 * Llama onDetected(code) al leer un código.
 *
 * Notas de robustez:
 * - El arranque se difiere y es cancelable, para que el doble montaje de
 *   React StrictMode (modo dev) NO inicie dos cámaras ni pida 2 permisos.
 * - stop() solo se llama si el escáner está realmente escaneando (evita el
 *   error "Cannot stop, scanner is not running or paused.").
 */
const BarcodeScanner = ({ onDetected, onError }) => {
  const scannerRef = useRef(null)
  // Guardar los callbacks en refs para no reiniciar el efecto en cada render
  const onDetectedRef = useRef(onDetected)
  const onErrorRef = useRef(onError)
  onDetectedRef.current = onDetected
  onErrorRef.current = onError

  useEffect(() => {
    let cancelado = false

    const detener = async () => {
      const scanner = scannerRef.current
      if (!scanner) return
      try {
        const SCANNING = 2 // Html5QrcodeScannerState.SCANNING
        if (typeof scanner.getState === 'function' && scanner.getState() === SCANNING) {
          await scanner.stop()
        }
        scanner.clear()
      } catch {
        /* el escáner no estaba activo: nada que detener */
      }
      scannerRef.current = null
    }

    // Diferir el arranque: si StrictMode desmonta de inmediato, se cancela
    // antes de pedir permiso de cámara.
    const timer = setTimeout(async () => {
      if (cancelado) return
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelado) return

        const scanner = new Html5Qrcode('pos-scanner-region', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decoded) => { if (!cancelado) onDetectedRef.current?.(decoded) },
          () => {},
        )

        // Si se desmontó mientras arrancaba, detener de inmediato.
        if (cancelado) detener()
      } catch (e) {
        scannerRef.current = null
        if (!cancelado) {
          onErrorRef.current?.(e?.message || 'No se pudo acceder a la cámara')
        }
      }
    }, 80)

    return () => {
      cancelado = true
      clearTimeout(timer)
      detener()
    }
  }, [])

  return (
    <div className="space-y-3">
      <div id="pos-scanner-region" className="w-full rounded-lg overflow-hidden bg-black" />
      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        Apunta la cámara al código de barras del producto
      </p>
    </div>
  )
}

export default BarcodeScanner
