import React, { useEffect, useState } from 'react'
import {
  Activity,
  Bot,
  ClipboardList,
  Clock,
  FileCode2,
  FolderClosed,
  LucideIcon,
  Settings,
  Sparkles,
  Terminal as TerminalIcon,
  Users,
} from 'lucide-react'
import { ActiveTab } from '../../App'
import { useConnectionStore } from '../../context/useConnectionStore'

interface HeaderProps {
  activeTab: ActiveTab
}

const tabMeta: Record<ActiveTab, { label: string; icon: LucideIcon; shortcut: string }> = {
  terminal:     { label: 'SSH Terminal',       icon: TerminalIcon,  shortcut: 'Ctrl+1' },
  files:        { label: 'File Manager',       icon: FolderClosed,  shortcut: 'Ctrl+2' },
  editor:       { label: 'Code Editor',        icon: FileCode2,     shortcut: 'Ctrl+3' },
  chat:         { label: 'Claude Chat',        icon: Bot,           shortcut: 'Ctrl+4' },
  'claude-cli': { label: 'Claude Code CLI',    icon: Sparkles,      shortcut: 'Ctrl+5' },
  monitor:      { label: 'Resource Monitor',   icon: Activity,      shortcut: 'Ctrl+6' },
  settings:     { label: 'Settings',           icon: Settings,      shortcut: 'Ctrl+,' },
  audit:        { label: 'Audit Log',          icon: ClipboardList, shortcut: 'Ctrl+7' },
  team:         { label: 'Team',               icon: Users,         shortcut: '' },
}

function useUptime(connected: boolean) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!connected) { setSeconds(0); return }
    setSeconds(0)
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [connected])

  if (!connected) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function Header({ activeTab }: HeaderProps) {
  const { activeServerId, servers, connectionStatus } = useConnectionStore()
  const activeServer = servers.find((s) => s.id === activeServerId)
  const meta = tabMeta[activeTab]
  const uptime = useUptime(connectionStatus === 'connected')
  const TabIcon = meta.icon

  return (
    <div style={styles.header}>
      <div style={styles.left}>
        <span style={styles.tabIcon}><TabIcon size={16} /></span>
        <h1 style={styles.title}>{meta.label}</h1>
        {activeServer && connectionStatus === 'connected' && (
          <span style={styles.serverBadge}>
            <span style={styles.connDot} />
            {activeServer.username}@{activeServer.host}:{activeServer.port}
          </span>
        )}
        {connectionStatus === 'connecting' && (
          <span style={{ ...styles.serverBadge, borderColor: 'rgba(255,152,0,0.3)', background: 'rgba(255,152,0,0.08)', color: 'var(--warning)' }}>
            <span style={{ ...styles.connDot, background: 'var(--warning)' }} className="status-dot-connecting" />
            Connecting...
          </span>
        )}
      </div>

      <div style={styles.right}>
        {uptime && (
          <span style={styles.uptime} data-tooltip="Session uptime">
            <Clock size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            {uptime}
          </span>
        )}
        <span style={styles.shortcutHint}>{meta.shortcut}</span>
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
    gap: '12px',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  tabIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap' as const,
  },
  serverBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--success)',
    background: 'rgba(76, 175, 80, 0.08)',
    padding: '2px 8px',
    borderRadius: '99px',
    border: '1px solid rgba(76, 175, 80, 0.25)',
    flexShrink: 0,
  },
  connDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--success)',
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
    WebkitAppRegion: 'no-drag' as any,
  },
  uptime: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  shortcutHint: {
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
  },
  version: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
}
