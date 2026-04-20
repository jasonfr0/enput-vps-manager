import { create } from 'zustand'

/** Visual variant for the confirm button. */
export type ConfirmVariant = 'primary' | 'danger'

export interface ConfirmOptions {
  title: string
  message?: string
  /** Text for the confirm button (default: "Confirm"). */
  confirmLabel?: string
  /** Text for the cancel button (default: "Cancel"). */
  cancelLabel?: string
  /** Visual treatment for the confirm button. */
  variant?: ConfirmVariant
  /**
   * If set, require the user to type this exact word before confirm is enabled.
   * Useful for destructive, irreversible actions ("CLEAR", "DELETE", etc.).
   */
  typedWord?: string
}

interface ConfirmState extends ConfirmOptions {
  id: string
  resolve: (result: boolean) => void
}

interface ConfirmStore {
  active: ConfirmState | null
  open: (opts: ConfirmOptions) => Promise<boolean>
  resolve: (result: boolean) => void
}

let nextId = 1

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  active: null,

  open: (opts) => {
    // Resolve any stale dialog to false before opening a new one — keeps the
    // promise chain clean if something triggers a second confirm before the
    // first one is dismissed.
    const prior = get().active
    if (prior) prior.resolve(false)

    return new Promise<boolean>((resolve) => {
      const id = `confirm_${nextId++}`
      set({
        active: {
          id,
          resolve: (result) => {
            // Only clear if we're still the active dialog (guard against races).
            const current = get().active
            if (current && current.id === id) set({ active: null })
            resolve(result)
          },
          ...opts,
        },
      })
    })
  },

  resolve: (result) => {
    const active = get().active
    if (active) active.resolve(result)
  },
}))

/**
 * Convenience: open a confirm dialog from anywhere without a hook.
 * Returns a promise that resolves to `true` (confirmed) or `false` (cancelled).
 */
export const confirmDialog = (opts: ConfirmOptions): Promise<boolean> =>
  useConfirmStore.getState().open(opts)
