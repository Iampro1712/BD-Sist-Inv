import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const CategoriaGastoForm = ({ onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.nombre.trim()) { setErrors({ nombre: 'El nombre es requerido' }); return }
    onSubmit({ nombre: formData.nombre.trim(), descripcion: formData.descripcion })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          type="text" name="nombre" value={formData.nombre} onChange={handleChange}
          className={inputCls(errors.nombre)} placeholder="Ej: Alquiler, Servicios, Salarios" autoFocus
        />
        {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Descripción <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text" name="descripcion" value={formData.descripcion} onChange={handleChange}
          className={inputCls(false)}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
          Cancelar
        </button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>Agregar categoría</Button>
      </div>
    </form>
  )
}

export default CategoriaGastoForm
