// Type definitions for the window.api exposed by preload
export interface ElectronAPI {
  terminal: {
    create: (connId: string, cols: number, rows: number) => Promise<{ shellId: string }>
    write: (connId: string, shellId: string, data: string) => void
    resize: (connId: string, shellId: string, cols: number, rows: number) => void
    close: (connId: string, shellId: string) => void
    onOutput: (callback: (data: { shellId: string; data: string }) => void) => () => void
  }
  sftp: {
    listDir: (connId: string, path: string) => Promise<any[]>
    readFile: (connId: string, path: string) => Promise<string>
    writeFile: (connId: string, path: string, content: string) => Promise<void>
    upload: (connId: string, localPath: string, remotePath: string) => Promise<void>
    download: (connId: string, remotePath: string, localPath: string) => Promise<void>
    delete: (connId: string, path: string) => Promise<void>
    rename: (connId: string, oldPath: string, newPath: string) => Promise<void>
    mkdir: (connId: string, path: string) => Promise<void>
    deleteDir: (connId: string, path: string) => Promise<void>
    onTransferProgress: (callback: (data: any) => void) => () => void
  }
  monitor: {
    start: (connId: string) => Promise<void>
    stop: (connId: string) => Promise<void>
    onUpdate: (callback: (data: any) => void) => () => void
  }
  claude: {
    chat: (connId: string, messages: any[]) => Promise<any>
    execute: (connId: string, command: string) => Promise<any>
    onStream: (callback: (data: any) => void) => () => void
  }
  servers: {
    list: () => Promise<any[]>
    add: (config: any) => Promise<any>
    update: (config: any) => Promise<any>
    delete: (id: string) => Promise<void>
  }
  settings: {
    get: (key: string, defaultValue: any) => Promise<any>
    set: (key: string, value: any) => Promise<void>
  }
  dialog: {
    openFile: (options?: any) => Promise<any>
    saveFile: (options?: any) => Promise<any>
  }
  notify: {
    send: (title: string, body?: string) => void
  }
  sshKeys: {
    listLocal: () => Promise<any[]>
    generate: (name: string, type: 'ed25519' | 'rsa', passphrase: string, comment: string) => Promise<any>
    delete: (name: string) => Promise<void>
    getPublic: (name: string) => Promise<string>
    listAuthorized: (connId: string) => Promise<any[]>
    addAuthorized: (connId: string, publicKeyLine: string) => Promise<void>
    removeAuthorized: (connId: string, rawLine: string) => Promise<void>
  }
  ssh: {
    connect: (serverId: string) => Promise<any>
    disconnect: (connId: string) => Promise<void>
    exec: (connId: string, command: string) => Promise<any>
    onStatusChange: (callback: (state: any) => void) => () => void
  }
  updater: {
    getState: () => Promise<any>
    check: () => Promise<any>
    download: () => Promise<void>
    install: () => void
    onStatus: (callback: (state: any) => void) => () => void
  }
  users: {
    isEmpty: () => Promise<boolean>
    authenticate: (username: string, password: string) => Promise<TeamUser>
    list: () => Promise<TeamUser[]>
    create: (username: string, password: string, role: UserRole, serverAccess: string[] | '*') => Promise<TeamUser>
    update: (id: string, changes: { role?: UserRole; serverAccess?: string[] | '*' }) => Promise<TeamUser>
    delete: (id: string) => Promise<void>
    changePassword: (id: string, newPassword: string) => Promise<void>
  }
  audit: {
    getEntries: (filter?: {
      connId?: string
      category?: string
      search?: string
      since?: string
      until?: string
      limit?: number
    }) => Promise<AuditEntry[]>
    clear: () => Promise<void>
    exportCsv: () => Promise<string>
  }
  authServer: {
    /** Persist the auth server base URL */
    setUrl: (url: string) => Promise<void>
    /** Retrieve the saved auth server base URL (empty string if not set) */
    getUrl: () => Promise<string>
    /** Ping the server to verify connectivity */
    test: () => Promise<{ ok: boolean; latencyMs: number }>
    /** Authenticate and receive tokens; tokens stored in OS safe-storage */
    login: (username: string, password: string) => Promise<{ user: RemoteUser }>
    /** Exchange the stored refresh token for a new pair; returns null if no session */
    refresh: () => Promise<{ user: RemoteUser } | null>
    /** Revoke the current refresh token and clear the local session */
    logout: () => Promise<void>
    // ── User management (admin only) ───────────────────────────────────────
    listUsers: () => Promise<RemoteUser[]>
    createUser: (
      username: string,
      password: string,
      role: UserRole,
      serverAccess: string[] | '*'
    ) => Promise<RemoteUser>
    updateUser: (id: string, changes: { role?: UserRole; serverAccess?: string[] | '*' }) => Promise<RemoteUser>
    deleteUser: (id: string) => Promise<void>
    changePassword: (id: string, newPassword: string) => Promise<void>
    // ── Server registry (shared, non-sensitive) ────────────────────────────
    listServers: () => Promise<RemoteServer[]>
    createServer: (
      name: string,
      host: string,
      port: number,
      username: string,
      authType: string
    ) => Promise<RemoteServer>
    updateServer: (id: string, changes: Partial<RemoteServer>) => Promise<RemoteServer>
    deleteServer: (id: string) => Promise<void>
  }
}

export type UserRole = 'admin' | 'operator' | 'readonly'

export interface TeamUser {
  id: string
  username: string
  role: UserRole
  serverAccess: string[] | '*'
  createdAt: string
  updatedAt: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  connId: string
  serverLabel: string
  category: 'connection' | 'terminal' | 'file' | 'claude'
  action: string
  details: string
  outcome: 'success' | 'failure'
}

/** User record returned by the remote auth server */
export interface RemoteUser {
  id: string
  username: string
  role: UserRole
  serverAccess: string[] | '*'
  createdAt: string
  updatedAt: string
}

/** Non-sensitive server record synced via the remote auth server */
export interface RemoteServer {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: string
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
