import { create } from 'zustand'

const KEY = 'navLayout'
export const NAV_LAYOUTS = ['top', 'sidebar']

const read = () => {
  try {
    const saved = localStorage.getItem(KEY)
    return NAV_LAYOUTS.includes(saved) ? saved : 'top'
  } catch {
    return 'top'
  }
}

/**
 * Preferencia de menú: 'top' (barra superior con desplegables) o 'sidebar'
 * (barra lateral). Persiste en localStorage, igual que el modo oscuro.
 */
const useNavLayout = create((set) => ({
  layout: read(),
  setLayout: (layout) => {
    if (!NAV_LAYOUTS.includes(layout)) return
    try { localStorage.setItem(KEY, layout) } catch { /* sin storage: solo dura la sesión */ }
    set({ layout })
  },
}))

export default useNavLayout
