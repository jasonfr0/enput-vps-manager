import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { SSHConnectionManager } from './managers/SSHConnectionManager'
import { SFTPManager } from './managers/SFTPManager'
import { CredentialManager } from './managers/CredentialManager'
import { ResourceMonitor } from './managers/ResourceMonitor'
import { ClaudeManager } from './managers/ClaudeManager'
import { SSHKeyManager } from './managers/SSHKeyManager'
import { UpdateManager } from './managers/UpdateManager'
import { AuditManager } from './managers/AuditManager'
import { UserManager } from './managers/UserManager'
import { registerIpcHandlers } from './ipc/handlers'
import log from 'electron-log'

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

// Initialize managers
const sshManager = new SSHConnectionManager()
const sftpManager = new SFTPManager()
const credentialManager = new CredentialManager()
const resourceMonitor = new ResourceMonitor()
const claudeManager = new ClaudeManager()
const sshKeyManager = new SSHKeyManager()
const updateManager = new UpdateManager()
const auditManager = new AuditManager()
const userManager = new UserManager()

// Load saved API key
const savedApiKey = credentialManager.getSetting<string | null>('claude_api_key', null)
if (savedApiKey) {
  claudeManager.setApiKey(savedApiKey)
  log.info('Claude API key loaded from settings')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Enput VPS Manager',
    backgroundColor: '#1a1b2e',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // ssh2 needs this off for the main process
    },
    show: false,
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
  })

  // Graceful show
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // External links open in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Give UpdateManager a reference to the window so it can push events
  updateManager.init(mainWindow)

  // Register IPC handlers
  registerIpcHandlers(
    mainWindow,
    sshManager,
    sftpManager,
    credentialManager,
    resourceMonitor,
    claudeManager,
    sshKeyManager,
    updateManager,
    auditManager,
    userManager
  )

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Start auto-update checks after the window is ready
  mainWindow.once('ready-to-show', () => {
    updateManager.checkOnStartup()
  })

  log.info('Main window created')
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Cleanup
  sshManager.disconnectAll()
  resourceMonitor.stopAll()
  updateManager.destroy()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  sshManager.disconnectAll()
  resourceMonitor.stopAll()
  updateManager.destroy()
})
