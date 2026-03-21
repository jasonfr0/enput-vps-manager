import { create } from 'zustand'

interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  modifyTime: number
}

interface FileStore {
  currentPath: string
  files: FileEntry[]
  selectedFiles: string[]
  isLoading: boolean
  error: string | null

  setCurrentPath: (path: string) => void
  setFiles: (files: FileEntry[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  toggleSelect: (path: string) => void
  clearSelection: () => void
  selectAll: () => void
}

export const useFileStore = create<FileStore>((set, get) => ({
  currentPath: '/',
  files: [],
  selectedFiles: [],
  isLoading: false,
  error: null,

  setCurrentPath: (path) => set({ currentPath: path, selectedFiles: [] }),
  setFiles: (files) => set({ files, isLoading: false, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),

  toggleSelect: (path) =>
    set((state) => ({
      selectedFiles: state.selectedFiles.includes(path)
        ? state.selectedFiles.filter((p) => p !== path)
        : [...state.selectedFiles, path],
    })),

  clearSelection: () => set({ selectedFiles: [] }),

  selectAll: () =>
    set((state) => ({
      selectedFiles: state.files.map((f) => f.path),
    })),
}))
