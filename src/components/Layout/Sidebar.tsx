import React, { FormEvent, useState } from 'react'
import {
  Activity,
  Bot,
  ClipboardList,
  FileCode2,
  FolderClosed,
  LogOut,
  LucideIcon,
  Plus,
  Settings,
  Sparkles,
  Terminal as TerminalIcon,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { ActiveTab } from '../../App'
import { useConnectionStore } from '../../context/useConnectionStore'
import { useSessionStore, ROLE_LABELS } from '../../context/useSessionStore'
import { confirmDialog } from '../../context/useConfirmStore'
import { notify } from '../../context/useNotificationStore'

interface SidebarProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  onAddServer: () => void
  onOpenSettings: () => void
}

const tabs: { id: ActiveTab; label: string; icon: LucideIcon; shortcut: string }[] = [
  { id: 'terminal',   label: 'Terminal',    icon: TerminalIcon,    shortcut: '⌃1' },
  { id: 'files',      label: 'Files',       icon: FolderClosed,    shortcut: '⌃2' },
  { id: 'editor',     label: 'Editor',      icon: FileCode2,       shortcut: '⌃3' },
  { id: 'chat',       label: 'Claude Chat', icon: Bot,             shortcut: '⌃4' },
  { id: 'claude-cli', label: 'Claude Code', icon: Sparkles,        shortcut: '⌃5' },
  { id: 'monitor',    label: 'Monitor',     icon: Activity,        shortcut: '⌃6' },
  { id: 'audit',      label: 'Audit Log',   icon: ClipboardList,   shortcut: '⌃7' },
]

// ── Credential prompt modal ───────────────────────────────────────────────────
// Shown when a server synced from the remote registry has no local credentials yet.

interface CredPrompt {
  serverId:  string
  name:      string
  host:      string
  port:      number
  username:  string
  authType:  'password' | 'key'
}

function CredentialModal({
  prompt,
  onCancel,
  onSaved,
}: {
  prompt: CredPrompt
  onCancel: () => void
  onSaved: (localServerId: string) => void
}) {
  const [authType, setAuthType]       = useState<'password' | 'key'>(prompt.authType)
  const [password, setPassword]       = useState('')
  const [keyPath, setKeyPath]         = useState('')
  const [passphrase, setPassphrase]   = useState('')
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState('')

  const pickKeyFile = async () => {
    const result = await window.api.dialog.openFile({
      title: 'Select SSH private key',
      filters: [{ name: 'All files', extensions: ['*'] }],
    })
    if (result?.filePaths?.[0]) setKeyPath(result.filePaths[0])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (authType === 'password' && !password) { setError('Password is required'); return }
    if (authType === 'key'      && !keyPath)  { setError('Select a private key file'); return }
    setBusy(true)
    try {
      // Save server locally with credentials, keeping the same ID it had on the
      // remote registry so that serverAccess checks continue to work correctly.
      const saved = await window.api.servers.add({
        id:             prompt.serverId,
        name:           prompt.name,
        host:           prompt.host,
        port:           prompt.port,
        username:       prompt.username,
        authType,
        password:       authType === 'password' ? password : undefined,
        privateKeyPath: authType === 'key'      ? keyPath  : undefined,
        passphrase:     authType === 'key' && passphrase   ? passphrase : undefined,
      })
      // Swap the remote-only entry for the locally-saved one in the store
      const store = useConnectionStore.getState()
      store.removeServer(prompt.serverId)
      store.addServer(saved)
      onSaved(saved.id)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save credentials')
      setBusy(false)
    }
  }

  return (
    <div style={credStyles.overlay}>
      <div style={credStyles.modal}>
        <div style={credStyles.header}>
          <span style={credStyles.title}>Enter SSH credentials</span>
          <button style={credStyles.closeBtn} onClick={onCancel} title="Close">
            <X size={16} />
          </button>
        </div>
        <div style={credStyles.serverInfo}>
          <span style={credStyles.serverName}>{prompt.name}</span>
          <span style={credStyles.serverAddr}>{prompt.username}@{prompt.host}:{prompt.port}</span>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Auth type toggle */}
          <div style={credStyles.toggleRow}>
            <button
              type="button"
              style={{ ...credStyles.toggleBtn, ...(authType === 'password' ? credStyles.toggleActive : {}) }}
              onClick={() => setAuthType('password')}
            >Password</button>
            <button
              type="button"
              style={{ ...credStyles.toggleBtn, ...(authType === 'key' ? credStyles.toggleActive : {}) }}
              onClick={() => setAuthType('key')}
            >SSH Key</button>
          </div>

          {authType === 'password' ? (
            <div style={credStyles.field}>
              <label style={credStyles.label}>Password</label>
              <input
                style={credStyles.input}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                disabled={busy}
              />
            </div>
          ) : (
            <>
              <div style={credStyles.field}>
                <label style={credStyles.label}>Private key file</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    style={{ ...credStyles.input, flex: 1 }}
                    value={keyPath}
                    onChange={e => setKeyPath(e.target.value)}
                    placeholder="Path to private key…"
                    disabled={busy}
                  />
                  <button type="button" style={credStyles.browseBtn} onClick={pickKeyFile} disabled={busy}>
                    Browse
                  </button>
                </div>
              </div>
              <div style={credStyles.field}>
                <label style={credStyles.label}>Passphrase <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(if any)</span></label>
                <input
                  style={credStyles.input}
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
            </>
          )}

          {error && <div style={credStyles.error}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button style={credStyles.connectBtn} type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save & Connect'}
            </button>
            <button style={credStyles.cancelBtn} type="button" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Sidebar({ activeTab, onTabChange, onAddServer, onOpenSettings }: SidebarProps) {
  const { servers, activeServerId, connectionStatus } = useConnectionStore()
  const { currentUser, logout, isAdmin, canAccessServer, isRemote } = useSessionStore()
  const userIsAdmin = isAdmin()

  // Credential prompt state — set when a remote-registry server has no local creds
  const [credPrompt, setCredPrompt] = useState<CredPrompt | null>(null)

  const handleConnect = async (serverId: string) => {
    try {
      useConnectionStore.getState().setConnectionStatus('connecting')
      await window.api.ssh.connect(serverId)
    } catch (err: any) {
      if (err.message?.includes('Server not found')) {
        // Server came from remote registry — prompt for credentials
        useConnectionStore.getState().setConnectionStatus('disconnected')
        const server = useConnectionStore.getState().servers.find(s => s.id === serverId)
        if (server) {
          setCredPrompt({
            serverId: server.id,
            name:     server.name,
            host:     server.host,
            port:     server.port,
            username: server.username,
            authType: (server as any).authType ?? 'password',
          })
        }
      } else {
        useConnectionStore.getState().setError(err.message)
      }
    }
  }

  const handleDisconnect = async () => {
    const connId = useConnectionStore.getState().activeConnId
    if (connId) {
      await window.api.ssh.disconnect(connId)
      useConnectionStore.getState().disconnect()
    }
  }

  const handleDeleteServer = async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId)
    const name = server?.name ?? 'this server'
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      message: 'The saved credentials and configuration will be removed. Active sessions to this server will disconnect.',
      confirmLabel: 'Delete server',
      variant: 'danger',
    })
    if (!ok) return
    if (activeServerId === serverId) await handleDisconnect()
    try {
      await window.api.servers.delete(serverId)
      useConnectionStore.getState().removeServer(serverId)
      notify.success('Server deleted', name)
    } catch (err: any) {
      console.error('Failed to delete server:', err)
      notify.error('Failed to delete server', err?.message ?? String(err))
    }
  }

  const isConnected = connectionStatus === 'connected'
  const isConnecting = connectionStatus === 'connecting'

  return (
    <div style={styles.sidebar}>
      {credPrompt && (
        <CredentialModal
          prompt={credPrompt}
          onCancel={() => setCredPrompt(null)}
          onSaved={(localId) => {
            setCredPrompt(null)
            handleConnect(localId)
          }}
        />
      )}
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoIcon}>
          <Zap size={16} strokeWidth={2.5} />
        </span>
        <span style={styles.logoText}>Enput VPS</span>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.sectionLabel}>Navigation</div>
        {tabs.filter(tab => tab.id !== 'audit' || true).map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              data-tooltip={`${tab.label} (Ctrl+${tab.shortcut.replace('⌃', '')})`}
            >
              <span style={styles.navIcon}><Icon size={15} /></span>
              <span style={styles.navLabel}>{tab.label}</span>
              <span className="shortcut-badge">{tab.shortcut}</span>
            </button>
          )
        })}
        {/* Team tab — admin only */}
        {userIsAdmin && (
          <button
            className={`nav-item${activeTab === 'team' ? ' active' : ''}`}
            onClick={() => onTabChange('team')}
            data-tooltip="Team (admin)"
          >
            <span style={styles.navIcon}><Users size={15} /></span>
            <span style={styles.navLabel}>Team</span>
          </button>
        )}
      </nav>

      {/* Servers */}
      <div style={styles.servers}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionLabel}>Servers</span>
          <button style={styles.addBtn} onClick={onAddServer} title="Add server">
            <Plus size={13} />
          </button>
        </div>

        <div style={styles.serverList}>
          {servers.filter(s => canAccessServer(s.id)).length === 0 && (
            <div style={styles.emptyServers}>No servers added yet</div>
          )}
          {servers.filter(s => canAccessServer(s.id)).map((server) => {
            const isActive = activeServerId === server.id

            return (
              <div
                key={server.id}
                className={`server-item${isActive ? ' active' : ''}`}
              >
                <div style={styles.serverInfo}>
                  <div
                    style={{
                      ...styles.statusDot,
                      background: isActive && isConnected
                        ? 'var(--success)'
                        : isActive && isConnecting
                        ? 'var(--warning)'
                        : 'var(--text-muted)',
                    }}
                    className={isActive && isConnecting ? 'status-dot-connecting' : ''}
                  />
                  <div style={styles.serverDetails}>
                    <div style={styles.serverName}>{server.name}</div>
                    <div style={styles.serverHost}>
                      {server.username}@{server.host}
                    </div>
                  </div>
                  <button
                    style={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); handleDeleteServer(server.id) }}
                    title="Delete server"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div style={styles.serverActions}>
                  {isActive && isConnected ? (
                    <button style={styles.disconnectBtn} onClick={handleDisconnect}>
                      Disconnect
                    </button>
                  ) : isActive && isConnecting ? (
                    <button style={{ ...styles.connectBtn, opacity: 0.6 }} disabled>
                      Connecting...
                    </button>
                  ) : (
                    <button
                      style={styles.connectBtn}
                      onClick={() => handleConnect(server.id)}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Settings button */}
      <div style={styles.settingsRow}>
        <button
          className={`nav-item${activeTab === 'settings' ? ' active' : ''}`}
          onClick={onOpenSettings}
          style={{ margin: '0 0 4px 0' }}
        >
          <span style={styles.navIcon}><Settings size={15} /></span>
          <span style={styles.navLabel}>Settings</span>
          <span className="shortcut-badge">⌃,</span>
        </button>
      </div>

      {/* Current user + logout */}
      {currentUser && (
        <div style={styles.userRow}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>
              {currentUser.username.slice(0, 1).toUpperCase()}
            </div>
            <div style={styles.userDetails}>
              <div style={styles.userName}>{currentUser.username}</div>
              <div style={styles.userRole}>{ROLE_LABELS[currentUser.role]}</div>
            </div>
          </div>
          <button
            style={styles.logoutBtn}
            title="Sign out"
            onClick={async () => {
              // For remote sessions, clear the persisted token first so
              // LoginScreen's silent-refresh doesn't log right back in.
              if (isRemote) {
                try { await window.api.authServer.logout() } catch { /* ignore */ }
              }
              logout()
            }}
          >
            <LogOut size={13} />
          </button>
        </div>
      )}

      {/* Status bar */}
      <div style={styles.statusBar}>
        <div
          style={{
            ...styles.statusIndicator,
            background:
              isConnected  ? 'var(--success)' :
              isConnecting ? 'var(--warning)' :
              connectionStatus === 'error' ? 'var(--error)' :
              'var(--text-muted)',
          }}
          className={isConnecting ? 'status-dot-connecting' : ''}
        />
        <span style={styles.statusText}>
          {isConnected  ? 'Connected' :
           isConnecting ? 'Connecting...' :
           connectionStatus === 'error' ? 'Connection error' :
           'Disconnected'}
        </span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
  },
  logoIcon: {
    color: 'var(--accent)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  nav: {
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
    padding: '0 8px 6px',
  },
  navIcon: {
    width: '18px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navLabel: {
    flex: 1,
    textAlign: 'left' as const,
  },
  servers: {
    flex: 1,
    overflow: 'auto',
    padding: '10px 8px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: '4px',
    marginBottom: '4px',
  },
  addBtn: {
    width: '20px',
    height: '20px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    padding: 0,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  emptyServers: {
    padding: '16px 8px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  serverInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.3s',
  },
  serverDetails: {
    flex: 1,
    overflow: 'hidden',
  },
  serverName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  serverHost: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  serverActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  deleteBtn: {
    width: '16px',
    height: '16px',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1,
    opacity: 0.5,
  },
  connectBtn: {
    padding: '3px 10px',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  disconnectBtn: {
    padding: '3px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  settingsRow: {
    padding: '4px 8px 0',
    borderTop: '1px solid var(--border)',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
    gap: '8px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  userAvatar: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userDetails: {
    minWidth: 0,
  },
  userName: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  userRole: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  logoutBtn: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderTop: '1px solid var(--border)',
    fontSize: '12px',
  },
  statusIndicator: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.3s',
  },
  statusText: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
}

const credStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    width: '360px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px 24px 24px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '2px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 10px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    marginBottom: '14px',
  },
  serverName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  serverAddr: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  toggleRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
  },
  toggleBtn: {
    flex: 1,
    padding: '6px 0',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  toggleActive: {
    background: 'rgba(99,102,241,0.15)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    marginBottom: '10px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '8px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  },
  browseBtn: {
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  error: {
    fontSize: '12px',
    color: '#f44336',
    padding: '6px 10px',
    background: 'rgba(244,67,54,0.1)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(244,67,54,0.25)',
    marginTop: '4px',
  },
  connectBtn: {
    flex: 1,
    padding: '9px 0',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    flex: 1,
    padding: '9px 0',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    cursor: 'pointer',
  },
}
