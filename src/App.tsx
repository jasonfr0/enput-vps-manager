import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { Header } from './components/Layout/Header'
import { TerminalView } from './components/Terminal/TerminalView'
import { FileBrowser } from './components/FileManager/FileBrowser'
import { CodeEditor } from './components/Editor/CodeEditor'
import { ChatInterface } from './components/Chat/ChatInterface'
import { ClaudeTerminal } from './components/Terminal/ClaudeTerminal'
import { ResourceMonitor } from './components/Dashboard/ResourceMonitor'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { AuditLog } from './components/Audit/AuditLog'
import { AddServerModal } from './components/ServerManager/AddServerModal'
import { ToastContainer } from './components/UI/ToastContainer'
import { UpdateBanner } from './components/UI/UpdateBanner'
import { useConnectionStore } from './context/useConnectionStore'
import { useSettingsStore } from './context/useSettingsStore'
import { useUpdateStore } from './context/useUpdateStore'
import { notify } from './context/useNotificationStore'

export type ActiveTab = 'terminal' | 'files' | 'editor' | 'chat' | 'claude-cli' | 'monitor' | 'settings' | 'audit'

const TAB_ORDER: ActiveTab[] = ['terminal', 'files', 'editor', 'chat', 'claude-cli', 'monitor', 'audit']
const LAST_SERVER_KEY = 'enput_last_server'

export default function App() {
  // Use the defaultTab setting as the initial tab on every launch
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const { defaultTab } = useSettingsStore.getState()
    return (TAB_ORDER.includes(defaultTab as ActiveTab) ? defaultTab : 'terminal') as ActiveTab
  })
  const [showAddServer, setShowAddServer] = useState(false)
  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null)
  const { activeConnId, connectionStatus } = useConnectionStore()

  // Tab change — no longer persists to localStorage (defaultTab setting owns this)
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab)
  }

  // When defaultTab setting changes, reflect it immediately only if we're still
  // on the previous default (i.e. user hasn't manually navigated away yet).
  // This makes the settings preview feel live without hijacking active navigation.
  useEffect(() => {
    return useSettingsStore.subscribe((settings) => {
      // intentionally no-op here: defaultTab only takes effect on next launch
    })
  }, [])

  // Ctrl+1–7 tab shortcuts + Ctrl+, for settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === ',') {
        e.preventDefault()
        handleTabChange('settings')
        return
      }
      const num = parseInt(e.key)
      if (num >= 1 && num <= TAB_ORDER.length) {
        e.preventDefault()
        handleTabChange(TAB_ORDER[num - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Load saved servers on mount, then auto-connect if the setting is on
  useEffect(() => {
    window.api.servers.list().then((servers: any[]) => {
      useConnectionStore.getState().setServers(servers)

      const { autoConnectLast } = useSettingsStore.getState()
      if (!autoConnectLast) return

      const lastServerId = localStorage.getItem(LAST_SERVER_KEY)
      if (!lastServerId) return

      const target = servers.find((s: any) => s.id === lastServerId)
      if (!target) return

      useConnectionStore.getState().setConnectionStatus('connecting')
      window.api.ssh.connect(lastServerId).catch((err: any) => {
        console.error('[App] Auto-connect failed:', err)
        useConnectionStore.getState().setError('Auto-connect failed: ' + err.message)
        notify.error('Auto-connect failed', err.message)
      })
    })
  }, [])

  // Listen for SSH status changes — fire toasts + native notifications
  useEffect(() => {
    const unsub = window.api.ssh.onStatusChange((state: any) => {
      if (state.status === 'connected') {
        const servers = useConnectionStore.getState().servers
        const server = servers.find((s: any) => s.id === state.serverId)
        const label = server?.name ?? server?.host ?? 'server'

        useConnectionStore.getState().setActiveConnection(state.id, state.serverId)
        localStorage.setItem(LAST_SERVER_KEY, state.serverId)

        notify.success('Connected', `SSH session established to ${label}`)
        ;(window.api as any).notify?.send('Enput VPS Manager', `Connected to ${label}`)

      } else if (state.status === 'error') {
        useConnectionStore.getState().setError(state.error || 'Connection failed')
        notify.error('Connection failed', state.error)
        ;(window.api as any).notify?.send('Enput VPS Manager', `Connection failed: ${state.error ?? ''}`)

      } else if (state.status === 'disconnected') {
        useConnectionStore.getState().disconnect()
        notify.info('Disconnected', 'SSH session closed')
      }
    })
    return unsub
  }, [])

  // Auto-updater — rehydrate state on startup and subscribe to push events
  useEffect(() => {
    const { rehydrate, subscribe } = useUpdateStore.getState()
    rehydrate()
    return subscribe()
  }, [])

  // Listen for file-transfer progress — notify on completion
  useEffect(() => {
    const seen = new Set<string>()
    const unsub = window.api.sftp.onTransferProgress(({ progress }: any) => {
      if (progress.percentage >= 100 && !seen.has(progress.filename)) {
        seen.add(progress.filename)
        notify.success('Transfer complete', progress.filename)
        ;(window.api as any).notify?.send('Enput VPS Manager', `Transfer complete: ${progress.filename}`)
        // Clean up the seen-set after a moment so the same filename can notify again
        setTimeout(() => seen.delete(progress.filename), 5000)
      }
    })
    return unsub
  }, [])

  const handleOpenFile = (path: string, content: string) => {
    setEditorFile({ path, content })
    handleTabChange('editor')
  }

  const renderActiveTab = () => {
    // Settings and Audit are always available regardless of connection
    if (activeTab === 'settings') return <SettingsPanel />
    if (activeTab === 'audit') return <AuditLog />

    if (!activeConnId || connectionStatus !== 'connected') {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>&#9889;</div>
          <h2 style={styles.emptyTitle}>No Active Connection</h2>
          {connectionStatus === 'connecting' ? (
            <p style={styles.emptyText}>Connecting to server…</p>
          ) : (
            <p style={styles.emptyText}>
              Select a server from the sidebar or add a new one to get started.
            </p>
          )}
          {connectionStatus !== 'connecting' && (
            <button style={styles.addButton} onClick={() => setShowAddServer(true)}>
              + Add Server
            </button>
          )}
        </div>
      )
    }

    switch (activeTab) {
      case 'terminal':
        return <TerminalView connId={activeConnId} />
      case 'files':
        return <FileBrowser connId={activeConnId} onOpenFile={handleOpenFile} />
      case 'editor':
        return (
          <CodeEditor
            key={editorFile?.path || 'empty'}
            connId={activeConnId}
            filePath={editorFile?.path}
            initialContent={editorFile?.content}
            onRequestOpen={() => handleTabChange('files')}
          />
        )
      case 'chat':
        return <ChatInterface connId={activeConnId} />
      case 'claude-cli':
        return <ClaudeTerminal connId={activeConnId} />
      case 'monitor':
        return <ResourceMonitor connId={activeConnId} />
      default:
        return null
    }
  }

  return (
    <div style={styles.container}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAddServer={() => setShowAddServer(true)}
        onOpenSettings={() => handleTabChange('settings')}
      />
      <div style={styles.main}>
        <Header activeTab={activeTab} />
        <UpdateBanner />
        <div style={styles.content}>
          <div key={activeTab} className="tab-content">
            {renderActiveTab()}
          </div>
        </div>
      </div>
      {showAddServer && (
        <AddServerModal onClose={() => setShowAddServer(false)} />
      )}
      <ToastContainer />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    height: 0,             // content height is 0 — only flex growth sets the size
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    color: 'var(--text-secondary)',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    maxWidth: '320px',
    textAlign: 'center' as const,
  },
  addButton: {
    marginTop: '12px',
    padding: '10px 24px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
}
