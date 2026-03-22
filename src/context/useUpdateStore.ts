import { create } from 'zustand'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  version?: string
  releaseNotes?: string
  progress?: {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
  }
  error?: string
}

interface UpdateStore extends UpdateState {
  // Actions
  setState: (partial: Partial<UpdateState>) => void
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => void
  /** Subscribe to main-process status pushes; returns unsubscribe fn. */
  subscribe: () => () => void
  /** Rehydrate from main process on renderer startup. */
  rehydrate: () => Promise<void>
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: 'idle',
  version: undefined,
  releaseNotes: undefined,
  progress: undefined,
  error: undefined,

  setState: (partial) => set((s) => ({ ...s, ...partial })),

  check: async () => {
    set({ status: 'checking', error: undefined })
    try {
      const state = await window.api.updater.check()
      if (state) set(state)
    } catch (err: any) {
      set({ status: 'error', error: err.message })
    }
  },

  download: async () => {
    set({ status: 'downloading', error: undefined })
    try {
      await window.api.updater.download()
    } catch (err: any) {
      set({ status: 'error', error: err.message })
    }
  },

  install: () => {
    window.api.updater.install()
  },

  subscribe: () => {
    return window.api.updater.onStatus((state: UpdateState) => {
      set(state)
    })
  },

  rehydrate: async () => {
    try {
      const state = await window.api.updater.getState()
      if (state) set(state)
    } catch {
      // ignore — updater may not be available in dev
    }
  },
}))
