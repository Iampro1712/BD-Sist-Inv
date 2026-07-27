import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Selector con buscador, en reemplazo de un `<select>` nativo cuando la lista
 * es larga o necesita más que texto plano en cada opción.
 *
 * Se despliega **en el flujo** (empuja lo de abajo) en vez de flotar encima:
 * el modal del proyecto tiene `overflow-y-auto`, así que un panel absoluto
 * quedaría recortado por el borde inferior.
 */
const Combobox = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'No hay coincidencias',
  // Debajo de esto el buscador estorba más de lo que ayuda.
  searchThreshold = 7,
  disabled = false,
  error,
}) => {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)

  const contenedorRef = useRef(null)
  const buscadorRef = useRef(null)
  const listaRef = useRef(null)

  const seleccionada = options.find((o) => o.value === value)
  const conBuscador = options.length > searchThreshold

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.value}`.toLowerCase().includes(q))
  }, [options, busqueda])

  // Al abrir, el cursor arranca sobre lo que ya estaba elegido. La búsqueda se
  // limpia al *cerrar* y no al abrir: si se limpiara acá, el efecto de abajo
  // correría después y devolvería el cursor a la primera fila.
  useEffect(() => {
    if (!abierto) {
      setBusqueda('')
      return
    }
    const i = options.findIndex((o) => o.value === value)
    setResaltado(i >= 0 ? i : 0)
    if (conBuscador) buscadorRef.current?.focus()
  }, [abierto])   // eslint-disable-line react-hooks/exhaustive-deps

  // Al escribir, el cursor vuelve arriba: si no, apunta a una fila que ya no está.
  useEffect(() => { setResaltado(0) }, [busqueda])

  // Mantiene visible la fila resaltada mientras se navega con el teclado.
  useEffect(() => {
    if (!abierto) return
    listaRef.current?.querySelector('[data-resaltado="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [resaltado, abierto])

  useEffect(() => {
    if (!abierto) return
    const alClicAfuera = (e) => {
      if (!contenedorRef.current?.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClicAfuera)
    return () => document.removeEventListener('mousedown', alClicAfuera)
  }, [abierto])

  const elegir = (opcion) => {
    onChange(opcion.value)
    setAbierto(false)
  }

  const alPresionarTecla = (e) => {
    if (e.key === 'Escape') { setAbierto(false); return }
    if (e.key === 'Tab') { setAbierto(false); return }

    // Cerrado, solo las flechas abren. Enter y espacio se dejan pasar: el
    // navegador ya los convierte en un clic sobre el botón, y atajarlos acá
    // abriría y cerraría en el mismo gesto.
    if (!abierto) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setAbierto(true)
      }
      return
    }

    // Home/End no se tocan: dentro del buscador tienen que mover el cursor del
    // texto, no saltar de fila.
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltado((i) => Math.min(i + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtradas[resaltado]) elegir(filtradas[resaltado])
    }
  }

  return (
    <div className="w-full" ref={contenedorRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={alPresionarTecla}
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2 rounded-lg border text-left
          bg-white dark:bg-gray-700 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error
            ? 'border-red-500 dark:border-red-400'
            : abierto
              ? 'border-primary-500 dark:border-primary-400'
              : 'border-gray-300 dark:border-gray-600'}
        `}
      >
        <span className={`truncate ${seleccionada
          ? 'text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-gray-400'}`}>
          {seleccionada?.label || placeholder}
        </span>
        <motion.svg
          animate={{ rotate: abierto ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="w-4 h-4 flex-shrink-0 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
              {conBuscador && (
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <input
                    ref={buscadorRef}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={alPresionarTecla}
                    placeholder={searchPlaceholder}
                    spellCheck={false}
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-gray-50 dark:bg-gray-900/60
                      border border-gray-200 dark:border-gray-700
                      text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}

              <ul ref={listaRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
                {filtradas.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    {emptyText}
                  </li>
                ) : filtradas.map((o, i) => {
                  const elegida = o.value === value
                  return (
                    <li key={o.value} role="option" aria-selected={elegida}
                      data-resaltado={i === resaltado}
                      onClick={() => elegir(o)}
                      onMouseEnter={() => setResaltado(i)}
                      className={`
                        flex items-center gap-2 px-3 py-2 cursor-pointer text-sm
                        ${i === resaltado ? 'bg-gray-100 dark:bg-gray-700/70' : ''}
                      `}
                    >
                      <svg className={`w-4 h-4 flex-shrink-0 ${elegida
                        ? 'text-primary-600 dark:text-primary-400' : 'text-transparent'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>

                      <span className={`flex-1 min-w-0 truncate ${elegida
                        ? 'font-medium text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'}`}>
                        {o.label}
                      </span>

                      {o.badge && (
                        <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wide
                          px-1.5 py-0.5 rounded
                          bg-primary-100 dark:bg-primary-900/40
                          text-primary-700 dark:text-primary-300">
                          {o.badge}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export default Combobox
