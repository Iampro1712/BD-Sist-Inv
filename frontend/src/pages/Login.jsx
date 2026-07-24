import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button, Card, Input } from '../components/ui'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../hooks/useAuthStore'
import { authService } from '../services/auth.service'
import { useDarkMode } from '../hooks/useDarkMode'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { isDark, toggleDarkMode } = useDarkMode()
  // Selectores atómicos: devuelven referencias estables y evitan el bucle de renders
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)
  const setUser = useAuthStore((s) => s.setUser)

  const [formData, setFormData] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Si ya hay sesión, fuera de /login
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const redirectTo = location.state?.from?.pathname || '/'

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.username.trim()) errs.username = 'El usuario es requerido'
    if (!formData.password) errs.password = 'La contraseña es requerida'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)

    // 1) Autenticación: SOLO aquí se muestra el error de credenciales.
    let data
    try {
      const res = await authService.login(formData)
      data = res.data
    } catch (err) {
      setIsLoading(false)
      const status = err.response?.status
      if (status === 429) {
        toast.error('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
      } else if (status === 400 || status === 401) {
        setErrors({ password: 'Usuario o contraseña incorrectos' })
        toast.error('Usuario o contraseña incorrectos')
      } else {
        toast.error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
      }
      return
    }

    // 2) Login OK: guardar tokens y entrar. Nada de aquí en adelante puede
    //    disparar el toast de credenciales incorrectas.
    login({ username: formData.username }, data.access, data.refresh)
    try {
      const me = await authService.me()
      setUser(me.data)
    } catch { /* datos extra del usuario son opcionales */ }
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900 relative">
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        title={isDark ? 'Modo claro' : 'Modo oscuro'}
      >
        {isDark ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          {/* Branding */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventrix</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sistema de gestión de inventario
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              name="username"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              placeholder="Usuario"
              autoFocus
              autoComplete="username"
              aria-invalid={!!errors.username}
            />

            {/* Contraseña con toggle mostrar/ocultar */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  className={`w-full px-4 py-2 pr-11 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
                    errors.password ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>}
            </div>

            <Button type="submit" loading={isLoading} disabled={isLoading} size="lg" className="w-full">
              Iniciar sesión
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          Inventrix · Hecho con ❤
        </p>
      </motion.div>
    </div>
  )
}

export default Login
