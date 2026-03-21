import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { SSHConnectionManager } from './managers/SSHConnectionManager'
import { SFTPManager } from './managers/SFTPManager'
import { CredentialManager } from './managers/CredentialManager'
import { ResourceMonitor } from './managers/ResourceMonitor'
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

  // Register IPC handlers
  registerIpcHandlers(
    mainWindow,
    sshManager,
    sftpManager,
    credentialManager,
    resourceMonitor
  )

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
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

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  sshManager.disconnectAll()
  resourceMonitor.stopAll()
})
