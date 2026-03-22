import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useFileStore } from '../../context/useFileStore'

interface FileBrowserProps {
  connId: string
  onOpenFile: (path: string, content: string) => void
}

// ─── File icon / color by extension ──────────────────────────────
function getFileIcon(name: string, type: string): string {
  if (type === 'directory') return '📁'
  if (type === 'symlink') return '🔗'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    js: 'JS', jsx: 'JSX', ts: 'TS', tsx: 'TSX',
    py: '🐍', rb: '💎', go: 'GO', rs: '🦀',
    sh: '$', bash: '$', zsh: '$',
    php: 'PHP', java: '☕', c: 'C', cpp: 'C++', cs: 'C#',
    html: '🌐', htm: '🌐', css: '🎨', scss: '🎨', sass: '🎨',
    json: '{ }', yaml: '—', yml: '—', toml: '—', xml: '< >',
    svg: '✦',
    md: '≡', txt: '≡', rst: '≡', log: '📋',
    png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', webp: '🖼', ico: '🖼',
    zip: '📦', tar: '📦', gz: '📦', bz2: '📦', xz: '📦',
    db: '🗄', sqlite: '🗄', sql: '🗄',
    env: '🔒', key: '🔒', pem: '🔒', crt: '🔒',
    mp4: '🎬', mkv: '🎬', mp3: '🎵', wav: '🎵',
  }
  return map[ext] ?? '📄'
}

function getIconColor(name: string, type: string): string {
  if (type === 'directory') return '#74b9ff'
  if (type === 'symlink') return '#a29bfe'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#3178c6',
    py: '#3776ab', rb: '#cc342d', go: '#00add8', rs: '#ce422b',
    sh: '#4eaa25', bash: '#4eaa25', zsh: '#4eaa25',
    html: '#e34c26', css: '#264de4', scss: '#cc6699',
    json: '#f1c40f', yaml: '#ff6b6b', yml: '#ff6b6b',
    md: '#83a598', log: '#636e72',
    png: '#a29bfe', jpg: '#a29bfe', jpeg: '#a29bfe', gif: '#fd79a8', svg: '#fd79a8',
    zip: '#fdcb6e', tar: '#fdcb6e', gz: '#fdcb6e',
    env: '#ff7675', key: '#ff7675', pem: '#ff7675',
    db: '#74b9ff', sql: '#74b9ff',
  }
  return map[ext] ?? 'var(--text-muted)'
}

// ─── Breadcrumb ───────────────────────────────────────────────────
function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path.split('/').filter(Boolean)
  return (
    <div style={bc.row}>
      <span style={bc.seg} onClick={() => onNavigate('/')}>/</span>
      {parts.map((part, i) => {
        const navPath = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        return (
          <React.Fragment key={navPath}>
            <span style={bc.sep}>/</span>
            <span
              style={{ ...bc.seg, ...(isLast ? bc.segLast : {}) }}
              onClick={() => !isLast && onNavigate(navPath)}
            >
              {part}
            </span>
          </React.Fragment>
        )
      })}
    </div>
  )
}
const bc: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: '1px', overflow: 'hidden', flex: 1, minWidth: 0 },
  seg: { fontSize: '12px', color: 'var(--accent)', cursor: 'pointer', padding: '2px 3px',
         borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0 },
  segLast: { color: 'var(--text-primary)', cursor: 'default' },
  sep: { fontSize: '12px', color: 'var(--border)', flexShrink: 0 },
}

// ─── Transfer Progress ────────────────────────────────────────────
interface TransferItem { filename: string; transferred: number; total: number; percentage: number; speed: number }
function formatSpeed(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}

// ─── Sort helpers ─────────────────────────────────────────────────
type SortKey = 'name' | 'size' | 'modifyTime'

// ─── Main Component ───────────────────────────────────────────────
export function FileBrowser({ connId, onOpenFile }: FileBrowserProps) {
  const {
    currentPath, files, isLoading, error,
    setCurrentPath, setFiles, setLoading, setError,
  } = useFileStore()

  const [openingFile, setOpeningFile] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newItemMode, setNewItemMode] = useState<'file' | 'folder' | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [transfers, setTransfers] = useState<Record<string, TransferItem>>({})
  const renameInputRef = useRef<HTMLInputElement>(null)
  const newItemInputRef = useRef<HTMLInputElement>(null)

  // ── Load directory ────────────────────────────────────────────
  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const entries = await window.api.sftp.listDir(connId, path)
      setCurrentPath(path)
      setFiles(entries)
    } catch (err: any) {
      setError(err.message || 'Failed to load directory')
    }
  }, [connId])

  useEffect(() => { loadDirectory(currentPath) }, [connId])

  // ── Transfer progress listener ────────────────────────────────
  useEffect(() => {
    const unsub = window.api.sftp.onTransferProgress(({ progress }: { progress: TransferItem }) => {
      setTransfers(prev => {
        const next = { ...prev, [progress.filename]: progress }
        if (progress.percentage >= 100) {
          setTimeout(() => setTransfers(p => {
            const n = { ...p }
            delete n[progress.filename]
            return n
          }), 1500)
        }
        return next
      })
    })
    return unsub
  }, [])

  // ── Sorted + filtered file list ───────────────────────────────
  const displayFiles = [...files]
    .filter(f => showHidden || !f.name.startsWith('.'))
    .sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'size') cmp = a.size - b.size
      else cmp = a.modifyTime - b.modifyTime
      return sortDir === 'asc' ? cmp : -cmp
    })

  const hiddenCount = files.filter(f => f.name.startsWith('.')).length

  // ── Sort click ─────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  // ── File open ──────────────────────────────────────────────────
  const isOpenable = (entry: any) => entry.type === 'file' || entry.type === 'symlink'

  const handleOpenFile = async (entry: any) => {
    if (!isOpenable(entry)) return
    setOpeningFile(entry.path)
    setError(null)
    try {
      const content = await window.api.sftp.readFile(connId, entry.path)
      onOpenFile(entry.path, content ?? '')
    } catch (err: any) {
      setError(`Failed to open ${entry.name}: ${err.message}`)
    } finally {
      setOpeningFile(null)
    }
  }

  // ── Navigation ─────────────────────────────────────────────────
  const handleGoUp = () => {
    if (currentPath === '/') return
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parent)
  }

  // ── Delete ─────────────────────────────────────────────────────
  const handleDelete = async (entry: any) => {
    if (!confirm(`Delete "${entry.name}"?`)) return
    try {
      if (entry.type === 'directory') {
        await (window.api.sftp as any).deleteDir(connId, entry.path)
      } else {
        await window.api.sftp.delete(connId, entry.path)
      }
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Delete failed: ${err.message}`)
    }
  }

  // ── Rename ─────────────────────────────────────────────────────
  const startRename = (entry: any) => {
    setRenamingPath(entry.path)
    setRenameValue(entry.name)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  const commitRename = async (entry: any) => {
    const trimmed = renameValue.trim()
    setRenamingPath(null)
    if (!trimmed || trimmed === entry.name) return
    const dir = entry.path.includes('/')
      ? entry.path.substring(0, entry.path.lastIndexOf('/')) || '/'
      : '/'
    const newPath = dir === '/' ? `/${trimmed}` : `${dir}/${trimmed}`
    try {
      await window.api.sftp.rename(connId, entry.path, newPath)
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Rename failed: ${err.message}`)
    }
  }

  // ── New item ───────────────────────────────────────────────────
  const startNew = (mode: 'file' | 'folder') => {
    setNewItemMode(mode)
    setNewItemName('')
    setTimeout(() => newItemInputRef.current?.focus(), 50)
  }

  const commitNew = async () => {
    const name = newItemName.trim()
    setNewItemMode(null)
    setNewItemName('')
    if (!name) return
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`
    try {
      if (newItemMode === 'folder') {
        await window.api.sftp.mkdir(connId, newPath)
      } else {
        await window.api.sftp.writeFile(connId, newPath, '')
      }
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Create ${newItemMode} failed: ${err.message}`)
    }
  }

  // ── Upload ─────────────────────────────────────────────────────
  const handleUpload = async () => {
    try {
      const result = await window.api.dialog.openFile({ properties: ['openFile', 'multiSelections'] })
      if (result.canceled || !result.filePaths.length) return
      for (const localPath of result.filePaths) {
        const filename = localPath.split(/[/\\]/).pop()
        const remotePath = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`
        await window.api.sftp.upload(connId, localPath, remotePath)
      }
      loadDirectory(currentPath)
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`)
    }
  }

  // ── Download ───────────────────────────────────────────────────
  const handleDownload = async (entry: any) => {
    try {
      const result = await window.api.dialog.saveFile({ defaultPath: entry.name })
      if (result.canceled || !result.filePath) return
      await window.api.sftp.download(connId, entry.path, result.filePath)
    } catch (err: any) {
      setError(`Download failed: ${err.message}`)
    }
  }

  // ── Format helpers ─────────────────────────────────────────────
  const formatSize = (bytes: number, type: string): string => {
    if (type === 'directory') return '—'
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
  }

  const formatDate = (ts: number): string =>
    new Date(ts).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const hasTransfers = Object.keys(transfers).length > 0

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={s.container}>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={s.toolbar}>
        <button style={s.toolBtn} onClick={handleGoUp} title="Go up (..)" disabled={currentPath === '/'}>
          ↑
        </button>
        <button style={s.toolBtn} onClick={() => loadDirectory(currentPath)} title="Refresh">
          ↻
        </button>
        <Breadcrumb path={currentPath} onNavigate={loadDirectory} />
        <div style={s.toolbarRight}>
          <button
            style={{ ...s.toolBtn, color: showHidden ? 'var(--accent)' : 'var(--text-muted)' }}
            onClick={() => setShowHidden(v => !v)}
            title={showHidden ? 'Hide dotfiles' : `Show hidden files (${hiddenCount})`}
          >
            {showHidden ? '👁' : '🙈'}
          </button>
          <button style={s.toolBtn} onClick={() => startNew('file')} title="New file">＋ File</button>
          <button style={s.toolBtn} onClick={() => startNew('folder')} title="New folder">＋ Folder</button>
          <button style={{ ...s.toolBtn, ...s.uploadBtn }} onClick={handleUpload} title="Upload files">
            ↑ Upload
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <div style={s.errorBanner}>
          <span>{error}</span>
          <button style={s.dismissBtn} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── File list ────────────────────────────────────────── */}
      <div style={s.fileList}>

        {/* Column headers */}
        <div style={s.fileHeader}>
          <span style={{ ...s.col, flex: 3, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
            Name{sortArrow('name')}
          </span>
          <span style={{ ...s.col, flex: 1, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('size')}>
            Size{sortArrow('size')}
          </span>
          <span style={{ ...s.col, flex: 2, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('modifyTime')}>
            Modified{sortArrow('modifyTime')}
          </span>
          <span style={{ ...s.col, flex: 1.5 }}>Actions</span>
        </div>

        {/* New item input row */}
        {newItemMode && (
          <div style={s.newItemRow}>
            <span style={{ marginRight: 8, fontSize: 14 }}>
              {newItemMode === 'folder' ? '📁' : '📄'}
            </span>
            <input
              ref={newItemInputRef}
              style={s.inlineInput}
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitNew()
                if (e.key === 'Escape') { setNewItemMode(null); setNewItemName('') }
              }}
              placeholder={newItemMode === 'folder' ? 'folder-name' : 'file.txt'}
            />
            <button style={s.editBtn} onClick={commitNew}>Create</button>
            <button style={s.cancelBtn} onClick={() => { setNewItemMode(null); setNewItemName('') }}>✕</button>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div style={s.emptyMsg}>Loading…</div>
        ) : displayFiles.length === 0 && !newItemMode ? (
          <div style={s.emptyMsg}>
            {showHidden ? 'Empty directory' : 'Empty directory (or all files are hidden)'}
          </div>
        ) : (

          displayFiles.map((entry) => {
            const isOpening = openingFile === entry.path
            const isRenaming = renamingPath === entry.path
            const icon = getFileIcon(entry.name, entry.type)
            const iconColor = getIconColor(entry.name, entry.type)

            return (
              <div
                key={entry.path}
                style={s.fileRow}
                onDoubleClick={() => {
                  if (entry.type === 'directory') loadDirectory(entry.path)
                  else if (isOpenable(entry)) handleOpenFile(entry)
                }}
              >
                {/* Name column */}
                <span style={{ ...s.col, flex: 3, minWidth: 0, gap: 6 }}>
                  <span style={{ ...s.iconBadge, color: iconColor }}>{icon}</span>
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      style={s.inlineInput}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(entry)
                        if (e.key === 'Escape') setRenamingPath(null)
                      }}
                      onBlur={() => commitRename(entry)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span style={{ ...s.fileName, color: entry.type === 'directory' ? 'var(--text-primary)' : 'inherit' }}>
                      {entry.name}
                    </span>
                  )}
                  {entry.type === 'symlink' && <span style={s.symBadge}>link</span>}
                </span>

                {/* Size column */}
                <span style={{ ...s.col, flex: 1, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {formatSize(entry.size, entry.type)}
                </span>

                {/* Modified column */}
                <span style={{ ...s.col, flex: 2, color: 'var(--text-muted)', fontSize: 11 }}>
                  {formatDate(entry.modifyTime)}
                </span>

                {/* Actions column */}
                <span style={{ ...s.col, flex: 1.5, gap: 4, flexShrink: 0 }}>
                  {entry.type === 'directory' ? (
                    <button style={s.editBtn} onClick={e => { e.stopPropagation(); loadDirectory(entry.path) }}>
                      Open
                    </button>
                  ) : isOpenable(entry) ? (
                    <button
                      style={s.editBtn}
                      disabled={isOpening}
                      onClick={e => { e.stopPropagation(); handleOpenFile(entry) }}
                    >
                      {isOpening ? '…' : 'Edit'}
                    </button>
                  ) : null}

                  {isOpenable(entry) && (
                    <button style={s.actionBtn} onClick={e => { e.stopPropagation(); handleDownload(entry) }} title="Download">
                      ↓
                    </button>
                  )}

                  <button
                    style={s.actionBtn}
                    onClick={e => { e.stopPropagation(); startRename(entry) }}
                    title="Rename"
                  >
                    ✎
                  </button>

                  <button
                    style={s.delBtn}
                    onClick={e => { e.stopPropagation(); handleDelete(entry) }}
                    title="Delete"
                  >
                    🗑
                  </button>
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* ── Status bar ───────────────────────────────────────── */}
      <div style={s.statusBar}>
        <span style={s.statusText}>
          {displayFiles.length} item{displayFiles.length !== 1 ? 's' : ''}
          {!showHidden && hiddenCount > 0 && ` · ${hiddenCount} hidden`}
        </span>
      </div>

      {/* ── Transfer progress overlay ─────────────────────────── */}
      {hasTransfers && (
        <div style={s.transferOverlay}>
          {Object.values(transfers).map(t => (
            <div key={t.filename} style={s.transferRow}>
              <span style={s.transferName}>{t.filename}</span>
              <div style={s.progressTrack}>
                <div style={{ ...s.progressFill, width: `${t.percentage}%` }} />
              </div>
              <span style={s.transferMeta}>{t.percentage}% · {formatSpeed(t.speed)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 10px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    minWidth: 0,
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  toolBtn: {
    padding: '3px 8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  uploadBtn: {
    color: 'var(--accent)',
    borderColor: 'var(--accent)',
  },
  errorBanner: {
    padding: '7px 12px',
    background: 'rgba(244, 67, 54, 0.12)',
    borderBottom: '1px solid rgba(244, 67, 54, 0.3)',
    color: 'var(--error)',
    fontSize: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--error)',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    flexShrink: 0,
  },
  fileList: {
    flex: 1,
    overflow: 'auto',
  },
  fileHeader: {
    display: 'flex',
    padding: '5px 10px',
    borderBottom: '1px solid var(--border)',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-secondary)',
    zIndex: 1,
    gap: 4,
  },
  col: {
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  newItemRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(100, 108, 255, 0.07)',
    gap: 6,
  },
  fileRow: {
    display: 'flex',
    padding: '5px 10px',
    borderBottom: '1px solid var(--border)',
    cursor: 'default',
    alignItems: 'center',
    gap: 4,
    transition: 'background 100ms',
  },
  iconBadge: {
    fontSize: '13px',
    flexShrink: 0,
    minWidth: 20,
    textAlign: 'center' as const,
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    lineHeight: 1,
  },
  fileName: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  symBadge: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '1px 4px',
    flexShrink: 0,
  },
  inlineInput: {
    flex: 1,
    padding: '3px 7px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  editBtn: {
    padding: '2px 8px',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  actionBtn: {
    padding: '2px 6px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '2px 6px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  delBtn: {
    padding: '2px 6px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--error)',
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  emptyMsg: {
    padding: '32px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  statusText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  transferOverlay: {
    position: 'absolute' as const,
    bottom: 28,   // sit above the status bar
    right: 12,
    width: 320,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-lg)',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 50,
  },
  transferRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  transferName: {
    fontSize: '11px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  progressTrack: {
    height: 4,
    background: 'var(--bg-tertiary)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 2,
    transition: 'width 200ms ease',
  },
  transferMeta: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
}
