import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import log from 'electron-log'

/** Promisified scrypt that includes the options parameter */
function scryptAsync(password: string, salt: string, keyLen: number, options: object): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    _scrypt(password, salt, keyLen, options, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'operator' | 'readonly'

export interface User {
  id: string
  username: string
  role: UserRole
  /** '*' means all servers; otherwise a list of server IDs */
  serverAccess: string[] | '*'
  createdAt: string
  updatedAt: string
}

interface UserRecord extends User {
  passwordHash: string // "salt:hash" hex strings
}

// What the renderer sees — no passwordHash
export type PublicUser = Omit<UserRecord, 'passwordHash'>

// ─── Constants ───────────────────────────────────────────────────────────────

const SCRYPT_KEYLEN = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }

function usersFilePath() {
  return join(app.getPath('userData'), 'users.json')
}

// ─── Password helpers ─────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex')
  const key = (await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)) as Buffer
  return `${salt}:${key.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const key = (await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)) as Buffer
  const stored_buf = Buffer.from(hash, 'hex')
  if (key.length !== stored_buf.length) return false
  return timingSafeEqual(key, stored_buf)
}

function newId(): string {
  return randomBytes(8).toString('hex')
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class UserManager {
  private users: UserRecord[] = []
  private loaded = false

  private load(): void {
    if (this.loaded) return
    this.loaded = true
    const path = usersFilePath()
    if (!existsSync(path)) {
      this.users = []
      return
    }
    try {
      this.users = JSON.parse(readFileSync(path, 'utf-8'))
    } catch (e) {
      log.error('[UserManager] Failed to load users.json:', e)
      this.users = []
    }
  }

  private save(): void {
    try {
      writeFileSync(usersFilePath(), JSON.stringify(this.users, null, 2), 'utf-8')
    } catch (e) {
      log.error('[UserManager] Failed to save users.json:', e)
    }
  }

  /** True if no users exist yet (first run) */
  isEmpty(): boolean {
    this.load()
    return this.users.length === 0
  }

  /** Create a user. Returns the public profile, throws on duplicate username. */
  async createUser(
    username: string,
    password: string,
    role: UserRole,
    serverAccess: string[] | '*' = '*'
  ): Promise<PublicUser> {
    this.load()
    if (this.users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error(`Username "${username}" already exists`)
    }
    const now = new Date().toISOString()
    const record: UserRecord = {
      id: newId(),
      username,
      role,
      serverAccess,
      createdAt: now,
      updatedAt: now,
      passwordHash: await hashPassword(password),
    }
    this.users.push(record)
    this.save()
    log.info(`[UserManager] Created user "${username}" (${role})`)
    return toPublic(record)
  }

  /** Authenticate. Returns public user on success, null on failure. */
  async authenticate(username: string, password: string): Promise<PublicUser | null> {
    this.load()
    const record = this.users.find((u) => u.username.toLowerCase() === username.toLowerCase())
    if (!record) return null
    const ok = await verifyPassword(password, record.passwordHash)
    if (!ok) return null
    log.info(`[UserManager] Authenticated user "${username}"`)
    return toPublic(record)
  }

  /** List all users (public profiles) */
  listUsers(): PublicUser[] {
    this.load()
    return this.users.map(toPublic)
  }

  /** Update role and/or server access. Returns updated public user. */
  updateUser(
    id: string,
    changes: Partial<Pick<User, 'role' | 'serverAccess'>>
  ): PublicUser {
    this.load()
    const record = this.users.find((u) => u.id === id)
    if (!record) throw new Error(`User ${id} not found`)
    if (changes.role !== undefined) record.role = changes.role
    if (changes.serverAccess !== undefined) record.serverAccess = changes.serverAccess
    record.updatedAt = new Date().toISOString()
    this.save()
    log.info(`[UserManager] Updated user "${record.username}"`)
    return toPublic(record)
  }

  /** Change a user's password */
  async changePassword(id: string, newPassword: string): Promise<void> {
    this.load()
    const record = this.users.find((u) => u.id === id)
    if (!record) throw new Error(`User ${id} not found`)
    record.passwordHash = await hashPassword(newPassword)
    record.updatedAt = new Date().toISOString()
    this.save()
    log.info(`[UserManager] Changed password for "${record.username}"`)
  }

  /** Delete a user. Can't delete the last admin. */
  deleteUser(id: string): void {
    this.load()
    const record = this.users.find((u) => u.id === id)
    if (!record) throw new Error(`User ${id} not found`)
    if (record.role === 'admin') {
      const adminCount = this.users.filter((u) => u.role === 'admin').length
      if (adminCount <= 1) throw new Error('Cannot delete the last admin account')
    }
    this.users = this.users.filter((u) => u.id !== id)
    this.save()
    log.info(`[UserManager] Deleted user "${record.username}"`)
  }

  /** Called when a server is deleted — remove it from all serverAccess lists */
  removeServerFromAll(serverId: string): void {
    this.load()
    let changed = false
    for (const u of this.users) {
      if (Array.isArray(u.serverAccess)) {
        const before = u.serverAccess.length
        u.serverAccess = u.serverAccess.filter((id) => id !== serverId)
        if (u.serverAccess.length !== before) changed = true
      }
    }
    if (changed) this.save()
  }
}

function toPublic(r: UserRecord): PublicUser {
  const { passwordHash: _ph, ...pub } = r
  return pub
}
