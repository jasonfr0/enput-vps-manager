import React from 'react'
import { ActiveTab } from '../../App'
import { useConnectionStore } from '../../context/useConnectionStore'

interface HeaderProps {
  activeTab: ActiveTab
}

const tabLabels: Record<ActiveTab, string> = {
  terminal: 'SSH Terminal',
  files: 'File Manager',
  editor: 'Code Editor',
  chat: 'Claude Assistant',
  monitor: 'Resource Monitor',
}

export function Header({ activeTab }: HeaderProps) {
  const { activeServerId, servers, connectionStatus } = useConnectionStore()
  const activeServer = servers.find((s) => s.id === activeServerId)

  return (
    <div style={styles.header}>
      <div style={styles.left}>
        <h1 style={styles.title}>{tabLabels[activeTab]}</h1>
        {activeServer && connectionStatus === 'connected' && (
          <span style={styles.serverBadge}>
            {activeServer.username}@{activeServer.host}:{activeServer.port}
          </span>
        )}
      </div>
      <div style={styles.right}>
        <span style={styles.version}>v1.0.0</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 'var(--header-height)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    WebkitAppRegion: 'drag' as any,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  serverBadge: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--success)',
    background: 'rgba(76, 175, 80, 0.1)',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid rgba(76, 175, 80, 0.3)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  version: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
}
