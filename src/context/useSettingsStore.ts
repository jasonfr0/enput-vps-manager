import { create } from 'zustand'

export interface AppSettings {
  // General
  defaultTab: string
  autoConnectLast: boolean

  // Editor
  editorFontSize: number
  editorTabSize: 2 | 4
  editorWordWrap: boolean
  editorMinimap: boolean
  editorLigatures: boolean

  // Terminal
  terminalFontSize: number
  terminalScrollback: number
  terminalCursorStyle: 'bar' | 'block' | 'underline'
  terminalCursorBlink: boolean
}

const DEFAULTS: AppSettings = {
  defaultTab: 'terminal',
  autoConnectLast: false,

  editorFontSize: 13,
  editorTabSize: 2,
  editorWordWrap: false,
  editorMinimap: true,
  editorLigatures: true,

  terminalFontSize: 14,
  terminalScrollback: 10000,
  terminalCursorStyle: 'bar',
  terminalCursorBlink: true,
}

const STORAGE_KEY = 'enput_settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

interface SettingsStore extends AppSettings {
  update: (patch: Partial<AppSettings>) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...loadSettings(),

  update: (patch) =>
    set((state) => {
      const next = { ...state, ...patch }
      saveSettings(next)
      return next
    }),

  reset: () =>
    set(() => {
      saveSettings(DEFAULTS)
      return { ...DEFAULTS }
    }),
}))
