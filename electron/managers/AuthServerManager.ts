/**
 * AuthServerManager
 *
 * Handles all communication between the Electron app and the remote
 * enput-auth-server. When an auth server URL is configured, login/user
 * management goes through here instead of the local UserManager.
 *
 * Tokens are persisted encrypted via Electron's safeStorage so the user
 * doesn't have to log in again after restarting the app.
 */

import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { request as httpsRequest } from 'https'
import { request as httpRequest }  from 'http'
import { URL } from 'url'
import log from 'electron-log'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemoteUser {
  id: string
  username: string
  role: 'admin' | 'operator' | 'readonly'
  serverAccess: string[] | '*'
  createdAt: string
  updatedAt: string
}

export interface RemoteServer {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  createdAt: string
  updatedAt: string
}

interface StoredSession {
  refreshToken: string
  userId: string
  username: string
  role: string
}

// ─── Token storage (encrypted with OS keychain via safeStorage) ───────────────

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'remote-session.enc')
}

function saveSession(session: StoredSession): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn('[AuthServer] safeStorage not available — session not persisted')
      return
    }
    const json = JSON.stringify(session)
    const enc  = safeStorage.encryptString(json)
    writeFileSync(sessionFilePath(), enc)
  } catch (e) {
    log.error('[AuthServer] Failed to save session:', e)
  }
}

function loadSession(): StoredSession | null {
  try {
    const path = sessionFilePath()
    if (!existsSync(path)) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    const enc  = readFileSync(path)
    const json = safeStorage.decryptString(enc)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function clearSession(): void {
  try {
    const path = sessionFilePath()
    if (existsSync(path)) unlinkSync(path)
  } catch {}
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function httpFetch(
  urlStr: string,
  method: string,
  body?: object,
  authToken?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(urlStr)
    const isHttps = parsed.protocol === 'https:'
    const reqFn   = isHttps ? httpsRequest : httpRequest

    const bodyStr = body ? JSON.stringify(body) : undefined
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`
    if (bodyStr)   headers['Content-Length'] = Buffer.byteLength(bodyStr)

    const req = reqFn(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers,
        // Allow self-signed certs on local network
        rejectUnauthorized: !parsed.hostname.match(/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/),
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (res.statusCode === 204) { resolve(null); return }
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode! >= 400) {
              reject(new Error(parsed.error ?? `HTTP ${res.statusCode}`))
            } else {
              resolve(parsed)
            }
          } catch {
            reject(new Error(`Invalid JSON response (HTTP ${res.statusCode})`))
          }
        })
      }
    )

    req.on('error', reject)
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('Request timed out')) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class AuthServerManager {
  private baseUrl: string = ''
  private accessToken: string = ''
  private publicKey: string = ''

  setBaseUrl(url: string): void {
    // Normalize: strip trailing slash
    this.baseUrl = url.replace(/\/$/, '')
  }

  getBaseUrl(): string { return this.baseUrl }
  isConfigured(): boolean { return this.baseUrl.length > 0 }

  private url(path: string): string {
    return `${this.baseUrl}/api${path}`
  }

  // ── Setup / health ──────────────────────────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; needsSetup: boolean }> {
    try {
      const data = await httpFetch(this.url('/setup/status'), 'GET')
      return { ok: true, needsSetup: data.needsSetup }
    } catch (e: any) {
      throw new Error(`Cannot reach auth server: ${e.message}`)
    }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<RemoteUser> {
    const data = await httpFetch(this.url('/auth/login'), 'POST', { username, password })
    this.accessToken = data.accessToken
    saveSession({
      refreshToken: data.refreshToken,
      userId: data.user.id,
      username: data.user.username,
      role: data.user.role,
    })
    log.info(`[AuthServer] Logged in as "${username}"`)
    return data.user
  }

  async tryRefresh(): Promise<RemoteUser | null> {
    const session = loadSession()
    if (!session) return null
    try {
      const data = await httpFetch(this.url('/auth/refresh'), 'POST', { refreshToken: session.refreshToken })
      this.accessToken = data.accessToken
      saveSession({
        refreshToken: data.refreshToken,
        userId: data.user.id,
        username: data.user.username,
        role: data.user.role,
      })
      log.info(`[AuthServer] Session refreshed for "${data.user.username}"`)
      return data.user
    } catch (e) {
      log.info('[AuthServer] Refresh failed:', e)
      clearSession()
      return null
    }
  }

  async logout(): Promise<void> {
    const session = loadSession()
    try {
      if (session) {
        await httpFetch(this.url('/auth/logout'), 'POST',
          { refreshToken: session.refreshToken }, this.accessToken)
      }
    } catch {}
    this.accessToken = ''
    clearSession()
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  async listUsers(): Promise<RemoteUser[]> {
    return httpFetch(this.url('/users'), 'GET', undefined, this.accessToken)
  }

  async createUser(username: string, password: string, role: string, serverAccess: string[] | '*'): Promise<RemoteUser> {
    return httpFetch(this.url('/users'), 'POST', { username, password, role, serverAccess }, this.accessToken)
  }

  async updateUser(id: string, changes: { role?: string; serverAccess?: string[] | '*' }): Promise<RemoteUser> {
    return httpFetch(this.url(`/users/${id}`), 'PATCH', changes, this.accessToken)
  }

  async deleteUser(id: string): Promise<void> {
    return httpFetch(this.url(`/users/${id}`), 'DELETE', undefined, this.accessToken)
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    return httpFetch(this.url(`/users/${id}/password`), 'POST', { newPassword }, this.accessToken)
  }

  // ── Servers ─────────────────────────────────────────────────────────────────

  async listServers(): Promise<RemoteServer[]> {
    return httpFetch(this.url('/servers'), 'GET', undefined, this.accessToken)
  }

  async createServer(name: string, host: string, port: number, username: string, authType: string): Promise<RemoteServer> {
    return httpFetch(this.url('/servers'), 'POST', { name, host, port, username, authType }, this.accessToken)
  }

  async updateServer(id: string, changes: Partial<Omit<RemoteServer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<RemoteServer> {
    return httpFetch(this.url(`/servers/${id}`), 'PATCH', changes, this.accessToken)
  }

  async deleteServer(id: string): Promise<void> {
    return httpFetch(this.url(`/servers/${id}`), 'DELETE', undefined, this.accessToken)
  }
}
