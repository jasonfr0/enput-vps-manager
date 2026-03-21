import { ipcMain, dialog, BrowserWindow } from 'electron'
import { SSHConnectionManager } from '../managers/SSHConnectionManager'
import { SFTPManager } from '../managers/SFTPManager'
import { CredentialManager } from '../managers/CredentialManager'
import { ResourceMonitor } from '../managers/ResourceMonitor'
import { IPC_CHANNELS, ServerConfig } from '../types'
import log from 'electron-log'

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  sshManager: SSHConnectionManager,
  sftpManager: SFTPManager,
  credentialManager: CredentialManager,
  resourceMonitor: ResourceMonitor
): void {
  // --- SSH Handlers ---

  ipcMain.handle(IPC_CHANNELS.SSH_CONNECT, async (_, { serverId }) => {
    const config = credentialManager.getServer(serverId)
    if (!config) throw new Error(`Server not found: ${serverId}`)

    const state = await sshManager.connect(config)
    return state
  })

  ipcMain.handle(IPC_CHANNELS.SSH_DISCONNECT, async (_, { connId }) => {
    await sshManager.disconnect(connId)
  })

  // Forward SSH state changes to renderer
  sshManager.on('stateChange', (state) => {
    mainWindow.webContents.send(IPC_CHANNELS.SSH_STATUS, state)
  })

  // --- Terminal Handlers ---

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_, { connId, cols, rows }) => {
      const { shellId, stream } = await sshManager.createShell(
        connId,
        cols,
        rows
      )

      // Forward shell output to renderer
      stream.on('data', (data: Buffer) => {
        mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, {
          shellId,
          data: data.toString(),
        })
      })

      stream.stderr?.on('data', (data: Buffer) => {
        mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, {
          shellId,
          data: data.toString(),
        })
      })

      return { shellId }
    }
  )

  ipcMain.on(
    IPC_CHANNELS.TERMINAL_INPUT,
    (_, { connId, shellId, data }) => {
      sshManager.writeToShell(connId, shellId, data)
    }
  )

  ipcMain.on(
    IPC_CHANNELS.TERMINAL_RESIZE,
    (_, { connId, shellId, cols, rows }) => {
      sshManager.resizeShell(connId, shellId, cols, rows)
    }
  )

  ipcMain.on(IPC_CHANNELS.TERMINAL_CLOSE, (_, { connId, shellId }) => {
    sshManager.closeShell(connId, shellId)
  })

  // --- SFTP Handlers ---

  ipcMain.handle(
    IPC_CHANNELS.SFTP_LIST_DIR,
    async (_, { connId, path }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      return sftpManager.listDirectory(connId, client, path)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SFTP_READ_FILE,
    async (_, { connId, path }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      return sftpManager.readFile(connId, client, path)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SFTP_WRITE_FILE,
    async (_, { connId, path, content }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      await sftpManager.writeFile(connId, client, path, content)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SFTP_UPLOAD,
    async (_, { connId, localPath, remotePath }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      await sftpManager.uploadFile(connId, client, localPath, remotePath)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SFTP_DOWNLOAD,
    async (_, { connId, remotePath, localPath }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      await sftpManager.downloadFile(connId, client, remotePath, localPath)
    }
  )

  ipcMain.handle(IPC_CHANNELS.SFTP_DELETE, async (_, { connId, path }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    await sftpManager.deleteFile(connId, client, path)
  })

  ipcMain.handle(
    IPC_CHANNELS.SFTP_RENAME,
    async (_, { connId, oldPath, newPath }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      await sftpManager.rename(connId, client, oldPath, newPath)
    }
  )

  ipcMain.handle(IPC_CHANNELS.SFTP_MKDIR, async (_, { connId, path }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    await sftpManager.mkdir(connId, client, path)
  })

  // Forward transfer progress to renderer
  sftpManager.on('transferProgress', ({ connId, progress }) => {
    mainWindow.webContents.send(IPC_CHANNELS.SFTP_TRANSFER_PROGRESS, {
      connId,
      progress,
    })
  })

  // --- Monitor Handlers ---

  ipcMain.handle(IPC_CHANNELS.MONITOR_START, async (_, { connId }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    resourceMonitor.startMonitoring(connId, client)
  })

  ipcMain.handle(IPC_CHANNELS.MONITOR_STOP, async (_, { connId }) => {
    resourceMonitor.stopMonitoring(connId)
  })

  resourceMonitor.on('metrics', ({ connId, metrics }) => {
    mainWindow.webContents.send(IPC_CHANNELS.MONITOR_UPDATE, {
      connId,
      metrics,
    })
  })

  // --- Claude Handlers ---

  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_EXECUTE,
    async (_, { connId, command }) => {
      return sshManager.executeCommand(connId, command)
    }
  )

  // --- Server Management Handlers ---

  ipcMain.handle(IPC_CHANNELS.SERVERS_LIST, async () => {
    return credentialManager.getAllServers()
  })

  ipcMain.handle(IPC_CHANNELS.SERVERS_ADD, async (_, config: ServerConfig) => {
    config.id = `server_${Date.now()}`
    credentialManager.saveServer(config)
    return config
  })

  ipcMain.handle(
    IPC_CHANNELS.SERVERS_UPDATE,
    async (_, config: ServerConfig) => {
      credentialManager.saveServer(config)
      return config
    }
  )

  ipcMain.handle(IPC_CHANNELS.SERVERS_DELETE, async (_, { id }) => {
    credentialManager.deleteServer(id)
  })

  // --- Settings Handlers ---

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    async (_, { key, defaultValue }) => {
      return credentialManager.getSetting(key, defaultValue)
    }
  )

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, { key, value }) => {
    credentialManager.setSetting(key, value)
  })

  // --- Dialog Handlers ---

  ipcMain.handle('dialog:openFile', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      ...options,
    })
    return result
  })

  ipcMain.handle('dialog:saveFile', async (_, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options)
    return result
  })

  log.info('IPC handlers registered')
}
