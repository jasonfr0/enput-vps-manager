import { safeStorage } from 'electron'
import Store from 'electron-store'
import { ServerConfig } from '../types'
import log from 'electron-log'

interface StoredServer {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
  encryptedPassword?: string
  encryptedPassphrase?: string
}

export class CredentialManager {
  private store: Store

  constructor() {
    this.store = new Store({
      name: 'enput-vps-servers',
      encryptionKey: 'enput-vps-manager-store-key',
    })
  }

  saveServer(config: ServerConfig): void {
    const stored: StoredServer = {
      id: config.id,
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      authType: config.authType,
      privateKeyPath: config.privateKeyPath,
    }

    // Encrypt sensitive fields
    if (config.password && safeStorage.isEncryptionAvailable()) {
      stored.encryptedPassword = safeStorage
        .encryptString(config.password)
        .toString('base64')
    }

    if (config.passphrase && safeStorage.isEncryptionAvailable()) {
      stored.encryptedPassphrase = safeStorage
        .encryptString(config.passphrase)
        .toString('base64')
    }

    const servers = this.getStoredServers()
    const idx = servers.findIndex((s) => s.id === config.id)
    if (idx >= 0) {
      servers[idx] = stored
    } else {
      servers.push(stored)
    }

    this.store.set('servers', servers)
    log.info(`Server saved: ${config.name} (${config.host})`)
  }

  getServer(id: string): ServerConfig | undefined {
    const servers = this.getStoredServers()
    const stored = servers.find((s) => s.id === id)
    if (!stored) return undefined

    return this.decryptServer(stored)
  }

  getAllServers(): ServerConfig[] {
    return this.getStoredServers().map((s) => this.decryptServer(s))
  }

  deleteServer(id: string): void {
    const servers = this.getStoredServers().filter((s) => s.id !== id)
    this.store.set('servers', servers)
    log.info(`Server deleted: ${id}`)
  }

  // Settings
  getSetting<T>(key: string, defaultValue: T): T {
    return this.store.get(key, defaultValue) as T
  }

  setSetting<T>(key: string, value: T): void {
    this.store.set(key, value)
  }

  private getStoredServers(): StoredServer[] {
    return (this.store.get('servers', []) as StoredServer[]) || []
  }

  private decryptServer(stored: StoredServer): ServerConfig {
    const config: ServerConfig = {
      id: stored.id,
      name: stored.name,
      host: stored.host,
      port: stored.port,
      username: stored.username,
      authType: stored.authType,
      privateKeyPath: stored.privateKeyPath,
    }

    if (stored.encryptedPassword && safeStorage.isEncryptionAvailable()) {
      try {
        config.password = safeStorage.decryptString(
          Buffer.from(stored.encryptedPassword, 'base64')
        )
      } catch {
        log.error(`Failed to decrypt password for server ${stored.id}`)
      }
    }

    if (stored.encryptedPassphrase && safeStorage.isEncryptionAvailable()) {
      try {
        config.passphrase = safeStorage.decryptString(
          Buffer.from(stored.encryptedPassphrase, 'base64')
        )
      } catch {
        log.error(`Failed to decrypt passphrase for server ${stored.id}`)
      }
    }

    return config
  }
}
