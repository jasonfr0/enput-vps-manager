import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { Header } from './components/Layout/Header'
import { TerminalView } from './components/Terminal/TerminalView'
import { FileBrowser } from './components/FileManager/FileBrowser'
import { CodeEditor } from './components/Editor/CodeEditor'
import { ChatInterface } from './components/Chat/ChatInterface'
import { ResourceMonitor } from './components/Dashboard/ResourceMonitor'
import { AddServerModal } from './components/ServerManager/AddServerModal'
import { useConnectionStore } from './context/useConnectionStore'

export type ActiveTab = 'terminal' | 'files' | 'editor' | 'chat' | 'monitor'

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('terminal')
  const [showAddServer, setShowAddServer] = useState(false)
  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null)
  const { activeConnId, connectionStatus } = useConnectionStore()

  // Load saved servers on mount
  useEffect(() => {
    window.api.servers.list().then((servers) => {
      useConnectionStore.getState().setServers(servers)
    })
  }, [])

  // Listen for SSH status changes
  useEffect(() => {
    const unsub = window.api.ssh.onStatusChange((state) => {
      if (state.status === 'connected') {
        useConnectionStore
          .getState()
          .setActiveConnection(state.id, state.serverId)
      } else if (state.status === 'error') {
        useConnectionStore.getState().setError(state.error || 'Connection failed')
      } else if (state.status === 'disconnected') {
        useConnectionStore.getState().disconnect()
      }
    })
    return unsub
  }, [])

  const handleOpenFile = (path: string, content: string) => {
    setEditorFile({ path, content })
    setActiveTab('editor')
  }

  const renderActiveTab = () => {
    if (!activeConnId || connectionStatus !== 'connected') {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>&#9889;</div>
          <h2 style={styles.emptyTitle}>No Active Connection</h2>
          <p style={styles.emptyText}>
            Select a server from the sidebar or add a new one to get started.
          </p>
          <button
            style={styles.addButton}
            onClick={() => setShowAddServer(true)}
          >
            + Add Server
          </button>
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
            connId={activeConnId}
            filePath={editorFile?.path}
            initialContent={editorFile?.content}
          />
        )
      case 'chat':
        return <ChatInterface connId={activeConnId} />
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
        onTabChange={setActiveTab}
        onAddServer={() => setShowAddServer(true)}
      />
      <div style={styles.main}>
        <Header activeTab={activeTab} />
        <div style={styles.content}>{renderActiveTab()}</div>
      </div>
      {showAddServer && (
        <AddServerModal onClose={() => setShowAddServer(false)} />
      )}
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
    overflow: 'hidden',
    position: 'relative',
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
