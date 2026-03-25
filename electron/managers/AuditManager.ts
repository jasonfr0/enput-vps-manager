import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface AuditEntry {
  id: string
  timestamp: string
  connId: string
  serverLabel: string
  category: 'connection' | 'terminal' | 'file' | 'claude'
  action: string
  details: string
  outcome: 'success' | 'failure'
}

export interface AuditFilter {
  connId?: string
  category?: string
  search?: string
  since?: string   // ISO date string
  until?: string
  limit?: number
}

export class AuditManager {
  private logPath: string
  // connId → friendly label e.g. "root@203.0.113.1"
  private serverLabels = new Map<string, string>()
  // `${connId}:${shellId}` → buffered command chars
  private cmdBuffers = new Map<string, string>()

  constructor() {
    const dir = app.getPath('userData')
    this.logPath = path.join(dir, 'audit.jsonl')
  }

  // ── Connection registry ────────────────────────────────────────────────────

  registerConnection(connId: string, label: string): void {
    this.serverLabels.set(connId, label)
  }

  unregisterConnection(connId: string): void {
    this.serverLabels.delete(connId)
    // clean up any open command buffers for this connection
    for (const key of this.cmdBuffers.keys()) {
      if (key.startsWith(`${connId}:`)) this.cmdBuffers.delete(key)
    }
  }

  getServerLabel(connId: string): string {
    return this.serverLabels.get(connId) ?? connId
  }

  // ── Terminal command buffering ─────────────────────────────────────────────
  // Called for every chunk of data the user sends to the shell.
  // Buffers printable characters; flushes a log entry when Enter (\r) is seen.

  feedInput(connId: string, shellId: string, data: string): void {
    const key = `${connId}:${shellId}`
    let buf = this.cmdBuffers.get(key) ?? ''

    for (let i = 0; i < data.length; i++) {
      const ch = data[i]
      const code = ch.charCodeAt(0)

      if (ch === '\r' || ch === '\n') {
        // Enter — flush buffer as a command
        const cmd = buf.trim()
        if (cmd) {
          this.log({
            connId,
            serverLabel: this.getServerLabel(connId),
            category: 'terminal',
            action: 'command',
            details: cmd,
            outcome: 'success',
          })
        }
        buf = ''
      } else if (ch === '\x7f' || ch === '\x08') {
        // Backspace
        buf = buf.slice(0, -1)
      } else if (ch === '\x03') {
        // Ctrl-C — clear buffer
        buf = ''
      } else if (ch === '\x1b') {
        // Escape sequence — skip to end of sequence
        // Most are ESC [ ... letter  or  ESC O letter
        i++ // skip '['  or 'O'
        while (i + 1 < data.length) {
          i++
          const c = data[i].charCodeAt(0)
          // Final byte of CSI sequence is in 0x40–0x7E range
          if (c >= 0x40 && c <= 0x7e) break
        }
      } else if (code >= 0x20 && code < 0x7f) {
        // Printable ASCII
        buf += ch
      }
      // Other control chars (tab, ctrl-*, etc.) are ignored
    }

    this.cmdBuffers.set(key, buf)
  }

  // ── Core log write ─────────────────────────────────────────────────────────

  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    const full: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    }
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(full) + '\n', 'utf8')
    } catch {
      // Non-fatal — audit logging should never crash the app
    }
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  getEntries(filter: AuditFilter = {}): AuditEntry[] {
    if (!fs.existsSync(this.logPath)) return []

    let lines: string[]
    try {
      lines = fs.readFileSync(this.logPath, 'utf8').split('\n').filter(Boolean)
    } catch {
      return []
    }

    let entries: AuditEntry[] = lines.map(l => {
      try { return JSON.parse(l) } catch { return null }
    }).filter(Boolean) as AuditEntry[]

    if (filter.connId)   entries = entries.filter(e => e.connId === filter.connId)
    if (filter.category) entries = entries.filter(e => e.category === filter.category)
    if (filter.since)    entries = entries.filter(e => e.timestamp >= filter.since!)
    if (filter.until)    entries = entries.filter(e => e.timestamp <= filter.until!)
    if (filter.search) {
      const q = filter.search.toLowerCase()
      entries = entries.filter(e =>
        e.details.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.serverLabel.toLowerCase().includes(q)
      )
    }

    // Most-recent-first
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    if (filter.limit) entries = entries.slice(0, filter.limit)
    return entries
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  clearAll(): void {
    try {
      fs.writeFileSync(this.logPath, '', 'utf8')
    } catch { /* non-fatal */ }
  }

  exportCsv(): string {
    const entries = this.getEntries()
    const header = 'id,timestamp,serverLabel,category,action,outcome,details'
    const rows = entries.map(e =>
      [e.id, e.timestamp, e.serverLabel, e.category, e.action, e.outcome,
       `"${e.details.replace(/"/g, '""')}"`].join(',')
    )
    return [header, ...rows].join('\n')
  }

  getLogPath(): string {
    return this.logPath
  }
}
