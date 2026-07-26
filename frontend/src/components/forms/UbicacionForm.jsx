import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const UbicacionForm = ({ ubicacion, bodegas = [], onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    bodega: ubicacion?.bodega || bodegas[0] || 'Principal',
    pasillo: ubicacion?.pasillo || '',
    estante: ubicacion?.estante || '',
    gaveta: ubicacion?.gaveta || '',
    notas: ubicacion?.notas || '',
    activo: ubicacion?.activo ?? true,
  })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.bodega.trim()) {
      setErrors({ bodega: 'La bodega es requerida' })
      return
    }
    onSubmit({
      bodega: formData.bodega.trim(),
      // Los niveles vacíos van como null: significan "este nivel no aplica".
      pasillo: formData.pasillo.trim() || null,
      estante: formData.estante.trim() || null,
      gaveta: formData.gaveta.trim() || null,
      notas: formData.notas.trim() || null,
      activo: formData.activo,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Bodega <span className="text-red-500">*</span>
        </label>
        <input type="text" name="bodega" value={formData.bodega} onChange={handleChange}
          list="bodegas-existentes" placeholder="Principal" className={inputCls(errors.bodega)} />
        <datalist id="bodegas-existentes">
          {bodegas.map((b) => <option key={b} value={b} />)}
        </datalist>
        {errors.bodega && <p className="mt-1 text-xs text-red-500">{errors.bodega}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pasillo
          </label>
          <input type="text" name="pasillo" value={formData.pasillo} onChange={handleChange}
            placeholder="2" className={inputCls(false)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Estante
          </label>
          <input type="text" name="estante" value={formData.estante} onChange={handleChange}
            placeholder="A" className={inputCls(false)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Gaveta
          </label>
          <input type="text" name="gaveta" value={formData.gaveta} onChange={handleChange}
            placeholder="5" className={inputCls(false)} />
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Los niveles que no uses podés dejarlos vacíos.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas
        </label>
        <input type="text" name="notas" value={formData.notas} onChange={handleChange}
          placeholder="Opcional" className={inputCls(false)} />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" name="activo" checked={formData.activo} onChange={handleChange}
          className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
        Activa
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : ubicacion ? 'Guardar cambios' : 'Crear ubicación'}
        </Button>
      </div>
    </form>
  )
}

export default UbicacionForm
