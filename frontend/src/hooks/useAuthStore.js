import { create } from 'zustand'

// Claves en localStorage
const ACCESS = 'auth_access'
const REFRESH = 'auth_refresh'
const USER = 'auth_user'

const readUser = () => {
  try { return JSON.parse(localStorage.getItem(USER) || 'null') } catch { return null }
}

/**
 * Estado global de autenticación con persistencia en localStorage.
 * Mismo patrón Zustand que useToast, con persistencia como useDarkMode.
 */
const useAuthStore = create((set) => ({
  user: readUser(),
  access: localStorage.getItem(ACCESS) || null,
  refresh: localStorage.getItem(REFRESH) || null,
  isAuthenticated: !!localStorage.getItem(ACCESS),

  login: (user, access, refresh) => {
    localStorage.setItem(ACCESS, access)
    localStorage.setItem(REFRESH, refresh)
    localStorage.setItem(USER, JSON.stringify(user))
    set({ user, access, refresh, isAuthenticated: true })
  },

  // Actualiza solo el access token (tras refresh)
  setAccess: (access) => {
    localStorage.setItem(ACCESS, access)
    set({ access })
  },

  setUser: (user) => {
    localStorage.setItem(USER, JSON.stringify(user))
    set({ user })
  },

  logout: () => {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
    localStorage.removeItem(USER)
    set({ user: null, access: null, refresh: null, isAuthenticated: false })
  },
}))

export default useAuthStore
