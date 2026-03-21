import React from 'react'
import { ActiveTab } from '../../App'
import { useConnectionStore } from '../../context/useConnectionStore'

interface SidebarProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  onAddServer: () => void
}

const tabs: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'terminal', label: 'Terminal', icon: '>_' },
  { id: 'files', label: 'Files', icon: '\u{1F4C1}' },
  { id: 'editor', label: 'Editor', icon: '\u{1F4DD}' },
  { id: 'chat', label: 'Claude', icon: '\u{1F916}' },
  { id: 'monitor', label: 'Monitor', icon: '\u{1F4CA}' },
]

export function Sidebar({ activeTab, onTabChange, onAddServer }: SidebarProps) {
  const {
    servers,
    activeServerId,
    connectionStatus,
  } = useConnectionStore()

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

  return (
    <div style={styles.sidebar}>
      {/* Logo area */}
      <div style={styles.logo}>
        <span style={styles.logoIcon}>&#9889;</span>
        <span style={styles.logoText}>Enput VPS</span>
      </div>

      {/* Navigation tabs */}
      <div style={styles.nav}>
        <div style={styles.sectionLabel}>Navigation</div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.navItem,
              ...(activeTab === tab.id ? styles.navItemActive : {}),
            }}
            onClick={() => onTabChange(tab.id)}
          >
            <span style={styles.navIcon}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Server list */}
      <div style={styles.servers}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionLabel}>Servers</span>
          <button style={styles.addBtn} onClick={onAddServer}>
            +
          </button>
        </div>

        <div style={styles.serverList}>
          {servers.length === 0 && (
            <div style={styles.emptyServers}>No servers added yet</div>
          )}
          {servers.map((server) => {
            const isActive = activeServerId === server.id
            const isConnecting =
              connectionStatus === 'connecting' && !isActive

            return (
              <div
                key={server.id}
                style={{
                  ...styles.serverItem,
                  ...(isActive ? styles.serverItemActive : {}),
                }}
              >
                <div style={styles.serverInfo}>
                  <div
                    style={{
                      ...styles.statusDot,
                      background: isActive
                        ? 'var(--success)'
                        : 'var(--text-muted)',
                    }}
                  />
                  <div style={styles.serverDetails}>
                    <div style={styles.serverName}>{server.name}</div>
                    <div style={styles.serverHost}>
                      {server.username}@{server.host}
                    </div>
                  </div>
                </div>
                {isActive ? (
                  <button
                    style={styles.disconnectBtn}
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    style={styles.connectBtn}
                    onClick={() => handleConnect(server.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? '...' : 'Connect'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <div
          style={{
            ...styles.statusIndicator,
            background:
              connectionStatus === 'connected'
                ? 'var(--success)'
                : connectionStatus === 'connecting'
                ? 'var(--warning)'
                : connectionStatus === 'error'
                ? 'var(--error)'
                : 'var(--text-muted)',
          }}
        />
        <span style={styles.statusText}>
          {connectionStatus === 'connected'
            ? 'Connected'
            : connectionStatus === 'connecting'
            ? 'Connecting...'
            : connectionStatus === 'error'
            ? 'Error'
            : 'Disconnected'}
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
    padding: '16px',
    borderBottom: '1px solid var(--border)',
  },
  logoIcon: {
    fontSize: '20px',
  },
  logoText: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  nav: {
    padding: '12px 8px',
    borderBottom: '1px solid var(--border)',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    padding: '0 8px 8px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  navItemActive: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
  },
  navIcon: {
    width: '20px',
    textAlign: 'center' as const,
    fontSize: '14px',
  },
  servers: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 8px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: '8px',
    marginBottom: '4px',
  },
  addBtn: {
    width: '22px',
    height: '22px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  emptyServers: {
    padding: '16px 8px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  serverItem: {
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  serverItemActive: {
    background: 'var(--bg-tertiary)',
  },
  serverInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  serverDetails: {
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
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  connectBtn: {
    padding: '4px 10px',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '11px',
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
  disconnectBtn: {
    padding: '4px 10px',
    border: '1px solid var(--error)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--error)',
    fontSize: '11px',
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    fontSize: '12px',
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    color: 'var(--text-secondary)',
  },
}
