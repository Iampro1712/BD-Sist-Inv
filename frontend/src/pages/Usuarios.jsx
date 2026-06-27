import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, staggerContainer } from '../utils/animations'
import {
  useUsuarios, useCreateUsuario, useUpdateUsuario, useDeleteUsuario, useSetPasswordUsuario,
} from '../hooks/useUsuarios'
import { useToast } from '../hooks/useToast'
import useAuthStore from '../hooks/useAuthStore'
import { Button, Card, Badge, Modal, ConfirmDialog } from '../components/ui'
import UsuarioForm from '../components/forms/UsuarioForm'

const formatFecha = (d) =>
  d ? new Date(d).toLocaleString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca'

const Usuarios = () => {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [pwdTarget, setPwdTarget] = useState(null)
  const [newPwd, setNewPwd] = useState('')
  const toast = useToast()
  const currentUser = useAuthStore((s) => s.user)

  const { data, isLoading, error } = useUsuarios()
  const createMut = useCreateUsuario()
  const updateMut = useUpdateUsuario()
  const deleteMut = useDeleteUsuario()
  const setPwdMut = useSetPasswordUsuario()

  const usuarios = data?.results || data || []

  const parseErr = (err, fallback) => {
    const d = err.response?.data
    if (typeof d === 'string') return d
    if (d?.detail) return d.detail
    if (d && typeof d === 'object') {
      const first = Object.values(d)[0]
      return Array.isArray(first) ? first[0] : String(first)
    }
    return fallback
  }

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: payload })
        toast.success('Usuario actualizado')
      } else {
        await createMut.mutateAsync(payload)
        toast.success('Usuario creado')
      }
      setIsFormOpen(false); setEditing(null)
    } catch (err) {
      toast.error(parseErr(err, 'Error al guardar el usuario'))
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(toDelete.id)
      toast.success('Usuario eliminado')
      setToDelete(null)
    } catch (err) {
      toast.error(parseErr(err, 'Error al eliminar'))
      setToDelete(null)
    }
  }

  const handleSetPwd = async () => {
    try {
      await setPwdMut.mutateAsync({ id: pwdTarget.id, password: newPwd })
      toast.success('Contraseña actualizada')
      setPwdTarget(null); setNewPwd('')
    } catch (err) {
      toast.error(parseErr(err, 'Error al cambiar la contraseña'))
    }
  }

  const openNew = () => { setEditing(null); setIsFormOpen(true) }
  const openEdit = (u) => { setEditing(u); setIsFormOpen(true) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona quién puede entrar al sistema</p>
        </div>
        <Button onClick={openNew} className="shrink-0">+ Nuevo usuario</Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-800 dark:text-red-400 text-sm">
          {error.response?.status === 403 ? 'No tienes permisos para gestionar usuarios.' : `Error al cargar usuarios: ${error.message}`}
        </div>
      )}

      {isLoading ? (
        <Card className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
        </Card>
      ) : usuarios.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No hay usuarios</h3>
          <Button className="mt-4" onClick={openNew}>+ Nuevo usuario</Button>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rol</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Último acceso</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {usuarios.map((u) => (
                  <motion.tr key={u.id} variants={fadeIn} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {u.username}
                      {currentUser?.username === u.username && <span className="ml-2 text-xs text-gray-400">(tú)</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{u.email || '—'}</td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={u.is_staff ? 'primary' : 'secondary'}>{u.rol || (u.is_staff ? 'Administrador' : 'Usuario')}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatFecha(u.last_login)}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(u)} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">Editar</button>
                        <button onClick={() => { setPwdTarget(u); setNewPwd('') }} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline">Contraseña</button>
                        <button onClick={() => setToDelete(u)} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">Eliminar</button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Crear / Editar */}
      <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditing(null) }}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'} size="md">
        <UsuarioForm
          usuario={editing}
          onSubmit={handleSubmit}
          onCancel={() => { setIsFormOpen(false); setEditing(null) }}
          isLoading={createMut.isPending || updateMut.isPending}
        />
      </Modal>

      {/* Cambiar contraseña */}
      <Modal isOpen={!!pwdTarget} onClose={() => setPwdTarget(null)}
        title={`Cambiar contraseña${pwdTarget ? ` · ${pwdTarget.username}` : ''}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva contraseña</label>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setPwdTarget(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancelar
            </button>
            <Button onClick={handleSetPwd} loading={setPwdMut.isPending} disabled={!newPwd || setPwdMut.isPending}>
              Actualizar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Eliminar */}
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        closeOnConfirm={false}
        loading={deleteMut.isPending}
        title="Eliminar usuario"
        message={toDelete ? `¿Eliminar al usuario "${toDelete.username}"? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  )
}

export default Usuarios
