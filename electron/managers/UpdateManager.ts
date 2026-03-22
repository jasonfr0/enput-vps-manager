import { BrowserWindow, app } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import log from 'electron-log'

// Feed electron-updater logs through electron-log
autoUpdater.logger = log
;(autoUpdater.logger as any).transports.file.level = 'info'

// Don't auto-download — let the user decide when to pull the update
autoUpdater.autoDownload = false
// Always install on next launch rather than immediately quitting mid-work
autoUpdater.autoInstallOnAppQuit = true

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  version?: string          // available version string
  releaseNotes?: string     // markdown release notes
  progress?: {
    percent: number
    transferred: number     // bytes
    total: number           // bytes
    bytesPerSecond: number
  }
  error?: string
}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000   // 4 hours
const STARTUP_DELAY_MS  = 10_000                // wait 10 s before first check

export class UpdateManager {
  private window: BrowserWindow | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private state: UpdateState = { status: 'idle' }

  constructor() {
    this.registerListeners()
  }

  /** Call after the main window is ready so events can reach the renderer. */
  init(window: BrowserWindow): void {
    this.window = window
  }

  /** Check once on startup (with a short delay so app feels snappy). */
  checkOnStartup(): void {
    // electron-updater only works in a packaged app — skip entirely in dev
    if (!app.isPackaged) {
      log.info('[UpdateManager] Skipping update check — running in dev mode (unpackaged)')
      return
    }

    setTimeout(() => {
      this.checkForUpdates()
    }, STARTUP_DELAY_MS)

    // Schedule recurring checks
    this.intervalId = setInterval(() => {
      this.checkForUpdates()
    }, CHECK_INTERVAL_MS)
  }

  /** Trigger a manual update check from the renderer. */
  async checkForUpdates(): Promise<void> {
    // electron-updater requires a packaged app to locate app-update.yml
    if (!app.isPackaged) {
      log.info('[UpdateManager] Skipping update check — running in dev mode (unpackaged)')
      this.setState({ status: 'not-available' })
      return
    }

    log.info('[UpdateManager] Checking for updates…')
    // Don't wrap in try/catch here — the 'error' event listener below handles
    // all failures, and catching here as well causes setState to be called twice.
    await autoUpdater.checkForUpdates()
  }

  /** Start downloading the available update. */
  async downloadUpdate(): Promise<void> {
    log.info('[UpdateManager] Starting download…')
    // Errors surface through the 'error' event listener — no need to catch here too
    await autoUpdater.downloadUpdate()
  }

  /** Quit and install the downloaded update immediately. */
  quitAndInstall(): void {
    log.info('[UpdateManager] Quitting and installing update…')
    autoUpdater.quitAndInstall(false, true)
  }

  /** Returns the current cached state (for IPC query). */
  getState(): UpdateState {
    return { ...this.state }
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private setState(partial: Partial<UpdateState>): void {
    this.state = { ...this.state, ...partial }
    this.push('update:status', this.state)
  }

  private push(channel: string, payload: any): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
  }

  private registerListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      log.info('[UpdateManager] checking-for-update')
      this.setState({ status: 'checking', error: undefined })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('[UpdateManager] update-available:', info.version)
      this.setState({
        status: 'available',
        version: info.version,
        releaseNotes: this.extractNotes(info.releaseNotes),
      })
    })

    autoUpdater.on('update-not-available', () => {
      log.info('[UpdateManager] update-not-available')
      this.setState({ status: 'not-available', version: undefined })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.setState({
        status: 'downloading',
        progress: {
          percent: Math.round(progress.percent),
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: Math.round(progress.bytesPerSecond),
        },
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info('[UpdateManager] update-downloaded:', info.version)
      this.setState({
        status: 'ready',
        version: info.version,
        releaseNotes: this.extractNotes(info.releaseNotes),
        progress: undefined,
      })
    })

    autoUpdater.on('error', (err: Error) => {
      log.error('[UpdateManager] error:', err.message)

      // A 404 means no releases have been published yet — treat it as
      // "up to date" rather than surfacing a confusing error to the user.
      const msg = err.message ?? ''
      if (
        msg.includes('404') ||
        msg.includes('net::ERR_') ||
        msg.toLowerCase().includes('cannot find latest')
      ) {
        log.info('[UpdateManager] No releases found — treating as up to date')
        this.setState({ status: 'not-available' })
        return
      }

      this.setState({ status: 'error', error: msg })
    })
  }

  /** Flatten release notes — can be a string or array of { version, note } */
  private extractNotes(notes: string | { version: string; note: string }[] | null | undefined): string {
    if (!notes) return ''
    if (typeof notes === 'string') return notes
    return notes.map(n => `**${n.version}**\n${n.note}`).join('\n\n')
  }
}
