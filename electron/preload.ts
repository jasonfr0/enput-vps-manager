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
    chat: (connId: string, messages: any[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CHAT, { connId, messages }),
    execute: (connId: string, command: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_EXECUTE, { connId, command }),
    setApiKey: (key: string) =>
      ipcRenderer.invoke('claude:setApiKey', { key }),
    getApiKey: () => ipcRenderer.invoke('claude:getApiKey'),
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
