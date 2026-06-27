import { useState, useEffect } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

/**
 * Form de crear/editar usuario. Al crear pide contraseña; al editar no (la
 * contraseña se cambia desde la acción "cambiar contraseña" del listado).
 */
const UsuarioForm = ({ usuario = null, onSubmit, onCancel, isLoading = false }) => {
  const editing = !!usuario
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', rol: 'usuario', is_active: true,
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (usuario) {
      setFormData({
        username: usuario.username || '',
        email: usuario.email || '',
        password: '',
        rol: usuario.is_staff ? 'admin' : 'usuario',
        is_active: usuario.is_active !== false,
      })
    }
  }, [usuario])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.username.trim()) errs.username = 'El usuario es requerido'
    if (!editing && !formData.password) errs.password = 'La contraseña es requerida'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const payload = {
      username: formData.username.trim(),
      email: formData.email.trim(),
      is_staff: formData.rol === 'admin',
      is_active: formData.is_active,
    }
    if (!editing) payload.password = formData.password
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Usuario <span className="text-red-500">*</span>
        </label>
        <input name="username" value={formData.username} onChange={handleChange}
          className={inputCls(errors.username)} placeholder="nombre de usuario" />
        {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input type="email" name="email" value={formData.email} onChange={handleChange}
          className={inputCls(false)} placeholder="correo@ejemplo.com" />
      </div>

      {!editing && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Contraseña <span className="text-red-500">*</span>
          </label>
          <input type="password" name="password" value={formData.password} onChange={handleChange}
            className={inputCls(errors.password)} placeholder="••••••••" autoComplete="new-password" />
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
          <select name="rol" value={formData.rol} onChange={handleChange} className={inputCls(false)}>
            <option value="usuario">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            Usuario activo
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button type="button" onClick={onCancel} disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
          Cancelar
        </button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          {editing ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  )
}

export default UsuarioForm
