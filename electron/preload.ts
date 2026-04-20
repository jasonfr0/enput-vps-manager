import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, ServerConfig } from './types'

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('api', {
  // SSH Connection + generic exec
  ssh: {
    connect: (serverId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSH_CONNECT, { serverId }),
    disconnect: (connId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSH_DISCONNECT, { connId }),
    exec: (connId: string, command: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSH_EXEC, { connId, command }),
    onStatusChange: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.SSH_STATUS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SSH_STATUS, handler)
    },
  },

  // Terminal
  terminal: {
    create: (connId: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, {
        connId,
        cols,
        rows,
      }),
    write: (connId: string, shellId: string, data: string) =>
      ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, {
        connId,
        shellId,
        data,
      }),
    resize: (connId: string, shellId: string, cols: number, rows: number) =>
      ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESIZE, {
        connId,
        shellId,
        cols,
        rows,
      }),
    close: (connId: string, shellId: string) =>
      ipcRenderer.send(IPC_CHANNELS.TERMINAL_CLOSE, { connId, shellId }),
    onOutput: (callback: (data: { shellId: string; data: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_OUTPUT, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_OUTPUT, handler)
    },
  },

  // SFTP / File operations
  sftp: {
    listDir: (connId: string, path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_LIST_DIR, { connId, path }),
    readFile: (connId: string, path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_READ_FILE, { connId, path }),
    writeFile: (connId: string, path: string, content: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_WRITE_FILE, {
        connId,
        path,
        content,
      }),
    upload: (connId: string, localPath: string, remotePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_UPLOAD, {
        connId,
        localPath,
        remotePath,
      }),
    download: (connId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_DOWNLOAD, {
        connId,
        remotePath,
        localPath,
      }),
    delete: (connId: string, path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_DELETE, { connId, path }),
    rename: (connId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_RENAME, {
        connId,
        oldPath,
        newPath,
      }),
    mkdir: (connId: string, path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_MKDIR, { connId, path }),
    deleteDir: (connId: string, path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SFTP_DELETE_DIR, { connId, path }),
    onTransferProgress: (callback: (data: any) => void) => {
      const handler = (_: any, payload: any) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.SFTP_TRANSFER_PROGRESS, handler)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.SFTP_TRANSFER_PROGRESS,
          handler
        )
    },
  },

  // Resource monitoring
  monitor: {
    start: (connId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MONITOR_START, { connId }),
    stop: (connId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MONITOR_STOP, { connId }),
    onUpdate: (callback: (data: any) => void) => {
      const handler = (_: any, payload: any) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.MONITOR_UPDATE, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.MONITOR_UPDATE, handler)
    },
  },

  // Claude integration
  claude: {
    chat: (connId: string, messages: any[], userId?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CHAT, { connId, messages, userId }),
    execute: (connId: string, command: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_EXECUTE, { connId, command }),
    setApiKey: (key: string, userId?: string) =>
      ipcRenderer.invoke('claude:setApiKey', { key, userId }),
    getApiKey: (userId?: string) => ipcRenderer.invoke('claude:getApiKey', { userId }),
    onStream: (callback: (data: any) => void) => {
      const handler = (_: any, payload: any) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_CHAT_STREAM, handler)
      return () =>
        ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_CHAT_STREAM, handler)
    },
  },

  // Server management
  servers: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.SERVERS_LIST),
    add: (config: ServerConfig) =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVERS_ADD, config),
    update: (config: ServerConfig) =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVERS_UPDATE, config),
    delete: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVERS_DELETE, { id }),
    remapId: (oldId: string, newId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVERS_REMAP_ID, { oldId, newId }),
  },

  // Settings
  settings: {
    get: (key: string, defaultValue: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, { key, defaultValue }),
    set: (key: string, value: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, { key, value }),
  },

  // SSH Key Management
  sshKeys: {
    listLocal: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SSHKEY_LIST_LOCAL),
    generate: (name: string, type: 'ed25519' | 'rsa', passphrase: string, comment: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSHKEY_GENERATE, { name, type, passphrase, comment }),
    delete: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSHKEY_DELETE, { name }),
    getPublic: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSHKEY_GET_PUBLIC, { name }),
    listAuthorized: (connId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSHKEY_LIST_AUTHORIZED, { connId }),
    addAuthorized: (connId: string, publicKeyLine: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSHKEY_ADD_AUTHORIZED, { connId, publicKeyLine }),
    removeAuthorized: (connId: string, rawLine: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SSHKEY_REMOVE_AUTHORIZED, { connId, rawLine }),
  },

  // Native OS notification (fires only when window is not focused)
  notify: {
    send: (title: string, body?: string) =>
      ipcRenderer.send('notify:send', { title, body }),
  },

  // Dialog helpers
  dialog: {
    openFile: (options?: any) =>
      ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options?: any) =>
      ipcRenderer.invoke('dialog:saveFile', options),
  },

  // User / team management
  users: {
    isEmpty: () =>
      ipcRenderer.invoke(IPC_CHANNELS.USER_IS_EMPTY),
    authenticate: (username: string, password: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.USER_AUTHENTICATE, { username, password }),
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.USER_LIST),
    create: (username: string, password: string, role: string, serverAccess: string[] | '*') =>
      ipcRenderer.invoke(IPC_CHANNELS.USER_CREATE, { username, password, role, serverAccess }),
    update: (id: string, changes: { role?: string; serverAccess?: string[] | '*' }) =>
      ipcRenderer.invoke(IPC_CHANNELS.USER_UPDATE, { id, changes }),
    delete: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.USER_DELETE, { id }),
    changePassword: (id: string, newPassword: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.USER_CHANGE_PASSWORD, { id, newPassword }),
  },

  // Remote auth server
  authServer: {
    setUrl: (url: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_SET_URL, { url }),
    getUrl: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_URL),
    test: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_TEST),
    login: (username: string, password: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_LOGIN, { username, password }),
    refresh: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_REFRESH),
    logout: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_LOGOUT),
    listUsers: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_LIST_USERS),
    createUser: (username: string, password: string, role: string, serverAccess: string[] | '*') =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_CREATE_USER, { username, password, role, serverAccess }),
    updateUser: (id: string, changes: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_UPDATE_USER, { id, changes }),
    deleteUser: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_DELETE_USER, { id }),
    changePassword: (id: string, newPassword: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_CHANGE_PW, { id, newPassword }),
    listServers: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_LIST_SERVERS),
    createServer: (name: string, host: string, port: number, username: string, authType: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_CREATE_SERVER, { name, host, port, username, authType }),
    updateServer: (id: string, changes: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_UPDATE_SERVER, { id, changes }),
    deleteServer: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_REMOTE_DELETE_SERVER, { id }),
  },

  // Audit log
  audit: {
    getEntries: (filter?: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIT_GET, filter),
    clear: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIT_CLEAR),
    exportCsv: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIT_EXPORT_CSV),
    /**
     * Notify the main process of the current session user. Entries logged
     * afterwards will carry attribution; non-admin viewers won't see admin
     * actions. Pass `null` on logout.
     */
    setCurrentUser: (
      user: { userId: string; username: string; userRole: 'admin' | 'operator' | 'readonly' } | null
    ) => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_SET_USER, user),
  },

  // Auto-updater
  updater: {
    /** Get the current update state (for rehydration on startup). */
    getState: () =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GET),
    /** Manually trigger an update check. */
    check: () =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    /** Start downloading the available update. */
    download: () =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    /** Quit and install the downloaded update. */
    install: () =>
      ipcRenderer.send(IPC_CHANNELS.UPDATE_INSTALL),
    /** Subscribe to status pushes from the main process. Returns unsubscribe fn. */
    onStatus: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS, handler)
    },
  },
})
