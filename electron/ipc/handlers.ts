import { ipcMain, dialog, BrowserWindow, Notification } from 'electron'
import { SSHConnectionManager } from '../managers/SSHConnectionManager'
import { SFTPManager } from '../managers/SFTPManager'
import { CredentialManager } from '../managers/CredentialManager'
import { ResourceMonitor } from '../managers/ResourceMonitor'
import { ClaudeManager } from '../managers/ClaudeManager'
import { SSHKeyManager } from '../managers/SSHKeyManager'
import { UpdateManager } from '../managers/UpdateManager'
import { AuditManager, AuditFilter } from '../managers/AuditManager'
import { IPC_CHANNELS, ServerConfig } from '../types'
import log from 'electron-log'

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  sshManager: SSHConnectionManager,
  sftpManager: SFTPManager,
  credentialManager: CredentialManager,
  resourceMonitor: ResourceMonitor,
  claudeManager: ClaudeManager,
  sshKeyManager: SSHKeyManager,
  updateManager: UpdateManager,
  auditManager: AuditManager
): void {
  // --- SSH Handlers ---

  ipcMain.handle(IPC_CHANNELS.SSH_CONNECT, async (_, { serverId }) => {
    const config = credentialManager.getServer(serverId)
    if (!config) throw new Error(`Server not found: ${serverId}`)

    try {
      const state = await sshManager.connect(config)
      const label = `${config.username}@${config.host}`
      auditManager.registerConnection(state.id, label)
      auditManager.log({
        connId: state.id, serverLabel: label,
        category: 'connection', action: 'connect',
        details: `Connected to ${label}:${config.port ?? 22}`,
        outcome: 'success',
      })
      return state
    } catch (err: any) {
      const label = `${config.username}@${config.host}`
      auditManager.log({
        connId: serverId, serverLabel: label,
        category: 'connection', action: 'connect',
        details: `Failed to connect to ${label}: ${err.message}`,
        outcome: 'failure',
      })
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.SSH_DISCONNECT, async (_, { connId }) => {
    const label = auditManager.getServerLabel(connId)
    await sshManager.disconnect(connId)
    auditManager.log({
      connId, serverLabel: label,
      category: 'connection', action: 'disconnect',
      details: `Disconnected from ${label}`,
      outcome: 'success',
    })
    auditManager.unregisterConnection(connId)
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
      auditManager.feedInput(connId, shellId, data)
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
      try {
        await sftpManager.uploadFile(connId, client, localPath, remotePath)
        auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'upload', details: remotePath, outcome: 'success' })
      } catch (err: any) {
        auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'upload', details: `${remotePath} — ${err.message}`, outcome: 'failure' })
        throw err
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SFTP_DOWNLOAD,
    async (_, { connId, remotePath, localPath }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      try {
        await sftpManager.downloadFile(connId, client, remotePath, localPath)
        auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'download', details: remotePath, outcome: 'success' })
      } catch (err: any) {
        auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'download', details: `${remotePath} — ${err.message}`, outcome: 'failure' })
        throw err
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.SFTP_DELETE, async (_, { connId, path }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    try {
      await sftpManager.deleteFile(connId, client, path)
      auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'delete', details: path, outcome: 'success' })
    } catch (err: any) {
      auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'delete', details: `${path} — ${err.message}`, outcome: 'failure' })
      throw err
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.SFTP_RENAME,
    async (_, { connId, oldPath, newPath }) => {
      const client = sshManager.getClient(connId)
      if (!client) throw new Error(`No connection: ${connId}`)
      try {
        await sftpManager.rename(connId, client, oldPath, newPath)
        auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'rename', details: `${oldPath} → ${newPath}`, outcome: 'success' })
      } catch (err: any) {
        auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'rename', details: `${oldPath} → ${newPath} — ${err.message}`, outcome: 'failure' })
        throw err
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.SFTP_MKDIR, async (_, { connId, path }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    try {
      await sftpManager.mkdir(connId, client, path)
      auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'mkdir', details: path, outcome: 'success' })
    } catch (err: any) {
      auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'mkdir', details: `${path} — ${err.message}`, outcome: 'failure' })
      throw err
    }
  })

  ipcMain.handle(IPC_CHANNELS.SFTP_DELETE_DIR, async (_, { connId, path }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    try {
      await sftpManager.deleteDirectory(connId, client, path)
      auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'delete-dir', details: path, outcome: 'success' })
    } catch (err: any) {
      auditManager.log({ connId, serverLabel: auditManager.getServerLabel(connId), category: 'file', action: 'delete-dir', details: `${path} — ${err.message}`, outcome: 'failure' })
      throw err
    }
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
    IPC_CHANNELS.CLAUDE_CHAT,
    async (_, { connId, messages }) => {
      return claudeManager.chat(messages)
    }
  )

  ipcMain.handle('claude:setApiKey', async (_, { key }) => {
    claudeManager.setApiKey(key)
    // Persist the key in settings
    credentialManager.setSetting('claude_api_key', key)
  })

  ipcMain.handle('claude:getApiKey', async () => {
    // Try to load from settings if not already set
    if (!claudeManager.getApiKey()) {
      const saved = credentialManager.getSetting('claude_api_key', null)
      if (saved) claudeManager.setApiKey(saved)
    }
    return claudeManager.getApiKey() ? true : false
  })

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

  // --- Generic SSH exec ---

  ipcMain.handle(IPC_CHANNELS.SSH_EXEC, async (_, { connId, command }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    return sshManager.executeCommand(connId, command)
  })

  // --- SSH Key Management ---

  ipcMain.handle(IPC_CHANNELS.SSHKEY_LIST_LOCAL, async () => {
    return sshKeyManager.listLocalKeys()
  })

  ipcMain.handle(IPC_CHANNELS.SSHKEY_GENERATE, async (_, { name, type, passphrase, comment }) => {
    return sshKeyManager.generateKey(name, type, passphrase ?? '', comment ?? '')
  })

  ipcMain.handle(IPC_CHANNELS.SSHKEY_DELETE, async (_, { name }) => {
    sshKeyManager.deleteKey(name)
  })

  ipcMain.handle(IPC_CHANNELS.SSHKEY_GET_PUBLIC, async (_, { name }) => {
    return sshKeyManager.getPublicKey(name)
  })

  ipcMain.handle(IPC_CHANNELS.SSHKEY_LIST_AUTHORIZED, async (_, { connId }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    return sshKeyManager.listAuthorizedKeys(client)
  })

  ipcMain.handle(IPC_CHANNELS.SSHKEY_ADD_AUTHORIZED, async (_, { connId, publicKeyLine }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    await sshKeyManager.addAuthorizedKey(client, publicKeyLine)
  })

  ipcMain.handle(IPC_CHANNELS.SSHKEY_REMOVE_AUTHORIZED, async (_, { connId, rawLine }) => {
    const client = sshManager.getClient(connId)
    if (!client) throw new Error(`No connection: ${connId}`)
    await sshKeyManager.removeAuthorizedKey(client, rawLine)
  })

  // --- Native OS Notification ---
  // Only fires a system notification when the window is not focused,
  // so it doesn't duplicate the in-app toast that's already visible.
  ipcMain.on('notify:send', (_, { title, body }: { title: string; body?: string }) => {
    if (mainWindow && !mainWindow.isFocused() && Notification.isSupported()) {
      new Notification({ title, body: body ?? '' }).show()
    }
  })

  // --- Auto-Updater ---

  // Query current state (e.g. on renderer startup to rehydrate)
  ipcMain.handle(IPC_CHANNELS.UPDATE_GET, () => {
    return updateManager.getState()
  })

  // Manual check triggered from renderer (e.g. "Check for updates" button)
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    await updateManager.checkForUpdates()
    return updateManager.getState()
  })

  // User clicked "Download" in the update banner
  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    await updateManager.downloadUpdate()
  })

  // User clicked "Restart & Install"
  ipcMain.on(IPC_CHANNELS.UPDATE_INSTALL, () => {
    updateManager.quitAndInstall()
  })

  // --- Audit Log Handlers ---

  ipcMain.handle(IPC_CHANNELS.AUDIT_GET, async (_, filter) => {
    return auditManager.getEntries(filter)
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_CLEAR, async () => {
    auditManager.clearAll()
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_EXPORT_CSV, async () => {
    return auditManager.exportCsv()
  })

  log.info('IPC handlers registered')
}
