import { create } from 'zustand'

const useToastStore = create((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
    return id
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },
}))

export const useToast = () => {
  const { addToast } = useToastStore()

  const toast = {
    success: (message) => addToast({ type: 'success', message }),
    error: (message) => addToast({ type: 'error', message }),
    info: (message) => addToast({ type: 'info', message }),
    warning: (message) => addToast({ type: 'warning', message }),
  }

  return toast
}

export default useToastStore
