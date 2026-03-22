import { create } from 'zustand'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number   // ms — 0 = sticky (no auto-dismiss)
}

interface NotificationStore {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

let nextId = 1

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = `toast_${nextId++}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    return id
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  dismissAll: () => set({ toasts: [] }),
}))

// Convenience helpers — call these from anywhere without a hook
export const notify = {
  success: (title: string, message?: string, duration = 4000) =>
    useNotificationStore.getState().add({ type: 'success', title, message, duration }),

  error: (title: string, message?: string, duration = 6000) =>
    useNotificationStore.getState().add({ type: 'error', title, message, duration }),

  warning: (title: string, message?: string, duration = 5000) =>
    useNotificationStore.getState().add({ type: 'warning', title, message, duration }),

  info: (title: string, message?: string, duration = 4000) =>
    useNotificationStore.getState().add({ type: 'info', title, message, duration }),
}
