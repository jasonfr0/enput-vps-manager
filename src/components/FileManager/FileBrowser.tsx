import React, { useEffect, useState, useCallback } from 'react'
import { useFileStore } from '../../context/useFileStore'

interface FileBrowserProps {
  connId: string
  onOpenFile: (path: string, content: string) => void
}

export function FileBrowser({ connId, onOpenFile }: FileBrowserProps) {
  const {
    currentPath,
    files,
    isLoading,
    error,
    setCurrentPath,
    setFiles,
    setLoading,
    setError,
    selectedFiles,
    toggleSelect,
    clearSelection,
  } = useFileStore()

  const loadDirectory = useCallback(
    async (path: string) => {
      setLoading(true)
      setError(null)
      try {
        const entries = await window.api.sftp.listDir(connId, path)
        setCurrentPath(path)
        setFiles(entries)
      } catch (err: any) {
        setError(err.message || 'Failed to load directory')
      }
    },
    [connId]
  )

  useEffect(() => {
    loadDirectory(currentPath)
  }, [connId])

  const handleNavigate = (entry: any) => {
    if (entry.type === 'directory') {
      loadDirectory(entry.path)
    }
  }

  const handleOpen = async (entry: any) => {
    if (entry.type === 'file') {
      try {
        const content = await window.api.sftp.readFile(connId, entry.path)
        onOpenFile(entry.path, content)
      } catch (err: any) {
        setError(`Failed to open file: ${err.message}`)
      }
    }
  }

  const handleGoUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parent)
  }

  const handleDelete = async (path: string) => {
    try {
      await window.api.sftp.delete(connId, path)
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Delete failed: ${err.message}`)
    }
  }

  const handleNewFolder = async () => {
    const name = prompt('New folder name:')
    if (!name) return
    try {
      const newPath =
        currentPath === '/' ? `/${name}` : `${currentPath}/${name}`
      await window.api.sftp.mkdir(connId, newPath)
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Create folder failed: ${err.message}`)
    }
  }

  const handleUpload = async () => {
    try {
      const result = await window.api.dialog.openFile({
        properties: ['openFile', 'multiSelections'],
      })
      if (result.canceled || !result.filePaths.length) return

      for (const localPath of result.filePaths) {
        const filename = localPath.split(/[/\\]/).pop()
        const remotePath =
          currentPath === '/'
            ? `/${filename}`
            : `${currentPath}/${filename}`
        await window.api.sftp.upload(connId, localPath, remotePath)
      }
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`)
    }
  }

  const handleDownload = async (remotePath: string) => {
    try {
      const filename = remotePath.split('/').pop()
      const result = await window.api.dialog.saveFile({
        defaultPath: filename,
      })
      if (result.canceled || !result.filePath) return
      await window.api.sftp.download(connId, remotePath, result.filePath)
    } catch (err: any) {
      setError(`Download failed: ${err.message}`)
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.pathBar}>
          <button style={styles.toolBtn} onClick={handleGoUp}>
            ..
          </button>
          <button
            style={styles.toolBtn}
            onClick={() => loadDirectory(currentPath)}
          >
            Refresh
          </button>
          <span style={styles.currentPath}>{currentPath}</span>
        </div>
        <div style={styles.actions}>
          <button style={styles.toolBtn} onClick={handleNewFolder}>
            New Folder
          </button>
          <button style={styles.toolBtn} onClick={handleUpload}>
            Upload
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.error}>
          {error}
          <button
            style={styles.dismissBtn}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* File list */}
      <div style={styles.fileList}>
        {/* Header */}
        <div style={styles.fileHeader}>
          <span style={{ ...styles.col, flex: 3 }}>Name</span>
          <span style={{ ...styles.col, flex: 1 }}>Size</span>
          <span style={{ ...styles.col, flex: 2 }}>Modified</span>
          <span style={{ ...styles.col, flex: 1 }}>Actions</span>
        </div>

        {isLoading ? (
          <div style={styles.loadingMsg}>Loading...</div>
        ) : (
          files.map((entry) => (
            <div
              key={entry.path}
              style={{
                ...styles.fileRow,
                ...(selectedFiles.includes(entry.path)
                  ? styles.fileRowSelected
                  : {}),
              }}
              onClick={() => toggleSelect(entry.path)}
              onDoubleClick={() =>
                entry.type === 'directory'
                  ? handleNavigate(entry)
                  : handleOpen(entry)
              }
            >
              <span style={{ ...styles.col, flex: 3 }}>
                <span style={styles.fileIcon}>
                  {entry.type === 'directory' ? '\u{1F4C1}' : '\u{1F4C4}'}
                </span>
                <span style={styles.fileName}>{entry.name}</span>
              </span>
              <span
                style={{
                  ...styles.col,
                  flex: 1,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                }}
              >
                {entry.type === 'file' ? formatSize(entry.size) : '-'}
              </span>
              <span
                style={{
                  ...styles.col,
                  flex: 2,
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                }}
              >
                {formatDate(entry.modifyTime)}
              </span>
              <span style={{ ...styles.col, flex: 1, gap: '4px' }}>
                {entry.type === 'file' && (
                  <>
                    <button
                      style={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpen(entry)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(entry.path)
                      }}
                    >
                      DL
                    </button>
                  </>
                )}
                <button
                  style={{ ...styles.actionBtn, color: 'var(--error)' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete ${entry.name}?`)) {
                      handleDelete(entry.path)
                    }
                  }}
                >
                  Del
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  pathBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  currentPath: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
  },
  actions: {
    display: 'flex',
    gap: '6px',
  },
  toolBtn: {
    padding: '4px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  error: {
    padding: '8px 12px',
    background: 'rgba(244, 67, 54, 0.1)',
    borderBottom: '1px solid rgba(244, 67, 54, 0.3)',
    color: 'var(--error)',
    fontSize: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--error)',
    cursor: 'pointer',
    fontSize: '11px',
    textDecoration: 'underline',
  },
  fileList: {
    flex: 1,
    overflow: 'auto',
  },
  fileHeader: {
    display: 'flex',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-primary)',
    zIndex: 1,
  },
  fileRow: {
    display: 'flex',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    alignItems: 'center',
    transition: 'background 0.1s',
  },
  fileRowSelected: {
    background: 'var(--accent-dim)',
  },
  col: {
    display: 'flex',
    alignItems: 'center',
  },
  fileIcon: {
    marginRight: '8px',
    fontSize: '14px',
  },
  fileName: {
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  actionBtn: {
    padding: '2px 6px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '10px',
    cursor: 'pointer',
  },
  loadingMsg: {
    padding: '24px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
  },
}
