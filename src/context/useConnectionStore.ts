import { create } from 'zustand'

interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
  password?: string
  passphrase?: string
}

interface ConnectionState {
  servers: ServerConfig[]
  activeConnId: string | null
  activeServerId: string | null
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  error: string | null

  setServers: (servers: ServerConfig[]) => void
  addServer: (server: ServerConfig) => void
  removeServer: (id: string) => void
  setActiveConnection: (connId: string, serverId: string) => void
  setConnectionStatus: (status: ConnectionState['connectionStatus']) => void
  setError: (error: string | null) => void
  disconnect: () => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  servers: [],
  activeConnId: null,
  activeServerId: null,
  connectionStatus: 'disconnected',
  error: null,

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((state) => ({ servers: [...state.servers, server] })),

  removeServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
    })),

  setActiveConnection: (connId, serverId) =>
    set({
      activeConnId: connId,
      activeServerId: serverId,
      connectionStatus: 'connected',
      error: null,
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setError: (error) => set({ error, connectionStatus: 'error' }),

  disconnect: () =>
    set({
      activeConnId: null,
      activeServerId: null,
      connectionStatus: 'disconnected',
      error: null,
    }),
}))
