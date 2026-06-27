import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usuariosService } from '../services/usuarios.service'

export const useUsuarios = (params = {}) => {
  return useQuery({
    queryKey: ['usuarios', params],
    queryFn: () => usuariosService.getAll(params).then((r) => r.data),
  })
}

export const useCreateUsuario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => usuariosService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export const useUpdateUsuario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => usuariosService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export const useDeleteUsuario = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => usuariosService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export const useSetPasswordUsuario = () => {
  return useMutation({
    mutationFn: ({ id, password }) => usuariosService.setPassword(id, password),
  })
}
