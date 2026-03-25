import React from 'react'
import { ActiveTab } from '../../App'
import { useConnectionStore } from '../../context/useConnectionStore'
import { useSessionStore, ROLE_LABELS } from '../../context/useSessionStore'

interface SidebarProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  onAddServer: () => void
  onOpenSettings: () => void
}

const tabs: { id: ActiveTab; label: string; icon: string; shortcut: string }[] = [
  { id: 'terminal',   label: 'Terminal',    icon: '>_', shortcut: '⌃1' },
  { id: 'files',      label: 'Files',       icon: '📁', shortcut: '⌃2' },
  { id: 'editor',     label: 'Editor',      icon: '📝', shortcut: '⌃3' },
  { id: 'chat',       label: 'Claude Chat', icon: '🤖', shortcut: '⌃4' },
  { id: 'claude-cli', label: 'Claude Code', icon: '✨', shortcut: '⌃5' },
  { id: 'monitor',    label: 'Monitor',     icon: '📊', shortcut: '⌃6' },
  { id: 'audit',      label: 'Audit Log',   icon: '📋', shortcut: '⌃7' },
]

export function Sidebar({ activeTab, onTabChange, onAddServer, onOpenSettings }: SidebarProps) {
  const { servers, activeServerId, connectionStatus } = useConnectionStore()
  const { currentUser, logout, isAdmin, canAccessServer } = useSessionStore()
  const userIsAdmin = isAdmin()

  const handleConnect = async (serverId: string) => {
    try {
      useConnectionStore.getState().setConnectionStatus('connecting')
      await window.api.ssh.connect(serverId)
    } catch (err: any) {
      useConnectionStore.getState().setError(err.message)
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
    if (!confirm('Delete this server?')) return
    if (activeServerId === serverId) await handleDisconnect()
    try {
      await window.api.servers.delete(serverId)
      useConnectionStore.getState().removeServer(serverId)
    } catch (err: any) {
      console.error('Failed to delete server:', err)
    }
  }

  const isConnected = connectionStatus === 'connected'
  const isConnecting = connectionStatus === 'connecting'

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoIcon}>⚡</span>
        <span style={styles.logoText}>Enput VPS</span>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.sectionLabel}>Navigation</div>
        {tabs.filter(tab => tab.id !== 'audit' || true).map((tab) => (
          <button
            key={tab.id}
            className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            data-tooltip={`${tab.label} (Ctrl+${tab.shortcut.replace('⌃', '')})`}
          >
            <span style={styles.navIcon}>{tab.icon}</span>
            <span style={styles.navLabel}>{tab.label}</span>
            <span className="shortcut-badge">{tab.shortcut}</span>
          </button>
        ))}
        {/* Team tab — admin only */}
        {userIsAdmin && (
          <button
            className={`nav-item${activeTab === 'team' ? ' active' : ''}`}
            onClick={() => onTabChange('team')}
            data-tooltip="Team (admin)"
          >
            <span style={styles.navIcon}>👥</span>
            <span style={styles.navLabel}>Team</span>
          </button>
        )}
      </nav>

      {/* Servers */}
      <div style={styles.servers}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionLabel}>Servers</span>
          <button style={styles.addBtn} onClick={onAddServer} title="Add server">+</button>
        </div>

        <div style={styles.serverList}>
          {servers.length === 0 && (
            <div style={styles.emptyServers}>No servers added yet</div>
          )}
          {servers.map((server) => {
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
                    ×
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
          <span style={styles.navIcon}>⚙️</span>
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
          <button style={styles.logoutBtn} onClick={logout} title="Sign out">
            ↩
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
  logoIcon: { fontSize: '18px' },
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
    textAlign: 'center' as const,
    fontSize: '13px',
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
    fontSize: '15px',
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
    fontSize: '14px',
    cursor: 'pointer',
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
    fontSize: '13px',
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
