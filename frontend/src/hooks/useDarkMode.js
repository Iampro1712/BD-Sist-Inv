import { useEffect, useState } from 'react'

export const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    // Verificar si hay preferencia guardada
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) {
      return JSON.parse(saved)
    }
    // Si no, usar preferencia del sistema
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = window.document.documentElement
    
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    
    // Guardar preferencia
    localStorage.setItem('darkMode', JSON.stringify(isDark))
  }, [isDark])

  const toggleDarkMode = () => {
    setIsDark(!isDark)
  }

  return { isDark, toggleDarkMode }
}
