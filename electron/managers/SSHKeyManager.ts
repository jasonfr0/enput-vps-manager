import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync, execFile } from 'child_process'
import log from 'electron-log'
import { Client } from 'ssh2'

export interface SSHKeyInfo {
  name: string
  privatePath: string
  publicPath: string
  type: string       // e.g. "ssh-ed25519", "ssh-rsa"
  comment: string
  fingerprint: string
}

export interface AuthorizedKey {
  type: string
  key: string
  comment: string
  raw: string        // full original line (used as stable identity for removal)
}

export class SSHKeyManager {
  readonly sshDir: string

  constructor() {
    this.sshDir = path.join(os.homedir(), '.ssh')
    if (!fs.existsSync(this.sshDir)) {
      fs.mkdirSync(this.sshDir, { mode: 0o700, recursive: true })
    }
  }

  // ── Local key operations ─────────────────────────────────────

  listLocalKeys(): SSHKeyInfo[] {
    const keys: SSHKeyInfo[] = []
    try {
      const files = fs.readdirSync(this.sshDir)
      const pubNames = files.filter(f => f.endsWith('.pub'))

      for (const pubFile of pubNames) {
        const name = pubFile.slice(0, -4)
        const privatePath = path.join(this.sshDir, name)
        const publicPath  = path.join(this.sshDir, pubFile)

        // Skip if there's no matching private key file
        if (!fs.existsSync(privatePath)) continue

        try {
          const pubContent = fs.readFileSync(publicPath, 'utf-8').trim()
          const parts = pubContent.split(' ')
          const type    = parts[0] ?? 'unknown'
          const comment = parts.slice(2).join(' ')
          const fingerprint = this.fingerprint(publicPath)
          keys.push({ name, privatePath, publicPath, type, comment, fingerprint })
        } catch (err) {
          log.warn(`[SSHKeyManager] Skipping key ${name}:`, err)
        }
      }
    } catch (err) {
      log.error('[SSHKeyManager] listLocalKeys failed:', err)
    }
    return keys
  }

  async generateKey(
    name: string,
    type: 'ed25519' | 'rsa',
    passphrase: string,
    comment: string
  ): Promise<SSHKeyInfo> {
    const keyPath = path.join(this.sshDir, name)
    if (fs.existsSync(keyPath)) {
      throw new Error(`A key named "${name}" already exists in ~/.ssh/`)
    }

    const typeArgs = type === 'rsa'
      ? ['-t', 'rsa', '-b', '4096']
      : ['-t', 'ed25519']

    const args = [
      ...typeArgs,
      '-C', comment || `enput-${name}`,
      '-f', keyPath,
      '-N', passphrase,   // empty string = no passphrase
    ]

    await new Promise<void>((resolve, reject) => {
      execFile('ssh-keygen', args, (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve()
      })
    })

    const publicPath = keyPath + '.pub'
    const pubContent = fs.readFileSync(publicPath, 'utf-8').trim()
    const parts = pubContent.split(' ')

    return {
      name,
      privatePath: keyPath,
      publicPath,
      type: parts[0] ?? `ssh-${type}`,
      comment: parts.slice(2).join(' '),
      fingerprint: this.fingerprint(publicPath),
    }
  }

  getPublicKey(name: string): string {
    const pubPath = path.join(this.sshDir, name + '.pub')
    if (!fs.existsSync(pubPath)) throw new Error(`Public key not found: ${name}.pub`)
    return fs.readFileSync(pubPath, 'utf-8').trim()
  }

  deleteKey(name: string): void {
    const priv = path.join(this.sshDir, name)
    const pub  = priv + '.pub'
    if (fs.existsSync(priv)) fs.unlinkSync(priv)
    if (fs.existsSync(pub))  fs.unlinkSync(pub)
  }

  private fingerprint(pubPath: string): string {
    try {
      const out = execSync(`ssh-keygen -l -f "${pubPath}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      })
      const match = out.match(/SHA256:\S+/)
      return match ? match[0] : '—'
    } catch {
      return '—'
    }
  }

  // ── Remote authorized_keys operations (via active SSH client) ─

  async listAuthorizedKeys(client: Client): Promise<AuthorizedKey[]> {
    const content = await this.execRemote(
      client,
      'cat ~/.ssh/authorized_keys 2>/dev/null || echo ""'
    )
    return this.parseAuthorizedKeys(content)
  }

  async addAuthorizedKey(client: Client, publicKeyLine: string): Promise<void> {
    const escaped = publicKeyLine.replace(/'/g, "'\\''")
    await this.execRemote(
      client,
      [
        'mkdir -p ~/.ssh',
        'chmod 700 ~/.ssh',
        `echo '${escaped}' >> ~/.ssh/authorized_keys`,
        'chmod 600 ~/.ssh/authorized_keys',
        'sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys',
      ].join(' && ')
    )
  }

  async removeAuthorizedKey(client: Client, rawLine: string): Promise<void> {
    // Escape the key line for use in a grep pattern (match on the key blob only)
    const parts = rawLine.trim().split(' ')
    const keyBlob = parts[1] ?? ''
    if (!keyBlob) throw new Error('Cannot identify key to remove')

    // Remove lines containing this key blob — safe because base64 blobs are unique
    const escaped = keyBlob.replace(/\//g, '\\/').replace(/\+/g, '\\+').replace(/=/g, '\\=')
    await this.execRemote(
      client,
      `sed -i '/${escaped}/d' ~/.ssh/authorized_keys 2>/dev/null || true`
    )
  }

  private execRemote(client: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) { reject(err); return }
        const chunks: Buffer[] = []
        const errChunks: Buffer[] = []
        stream.on('data', (d: Buffer) => chunks.push(d))
        stream.stderr.on('data', (d: Buffer) => errChunks.push(d))
        stream.on('close', (code: number) => {
          if (code !== 0 && errChunks.length > 0) {
            reject(new Error(Buffer.concat(errChunks).toString().trim()))
          } else {
            resolve(Buffer.concat(chunks).toString())
          }
        })
      })
    })
  }

  // ── Parsing helpers ───────────────────────────────────────────

  parseAuthorizedKeys(content: string): AuthorizedKey[] {
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(raw => {
        const parts = raw.split(' ')
        return { type: parts[0] ?? '', key: parts[1] ?? '', comment: parts.slice(2).join(' '), raw }
      })
  }
}
