import { create } from 'zustand'

interface ResourceMetrics {
  cpu: number
  memoryUsed: number
  memoryTotal: number
  diskUsed: number
  diskTotal: number
  uptime: number
  loadAverage: number[]
  timestamp: number
}

interface MonitorStore {
  metrics: ResourceMetrics[]
  latestMetrics: ResourceMetrics | null
  maxDataPoints: number

  addMetrics: (metrics: ResourceMetrics) => void
  clearMetrics: () => void
}

export const useMonitorStore = create<MonitorStore>((set) => ({
  metrics: [],
  latestMetrics: null,
  maxDataPoints: 60, // ~3 minutes at 3s intervals

  addMetrics: (metrics) =>
    set((state) => {
      const updated = [...state.metrics, metrics]
      // Keep only the last N data points
      const trimmed =
        updated.length > state.maxDataPoints
          ? updated.slice(-state.maxDataPoints)
          : updated
      return { metrics: trimmed, latestMetrics: metrics }
    }),

  clearMetrics: () => set({ metrics: [], latestMetrics: null }),
}))
