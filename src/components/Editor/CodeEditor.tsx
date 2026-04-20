import React, { useState, useRef, useEffect, useCallback } from 'react'
import Editor, { DiffEditor, OnMount, loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { Check, GitCompare } from 'lucide-react'
import { useSettingsStore } from '../../context/useSettingsStore'

// Configure Monaco to load workers from CDN (works in Electron without extra bundler config)
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs',
  },
})

interface CodeEditorProps {
  connId: string
  filePath?: string
  initialContent?: string
  onRequestOpen?: () => void
}

// Map file extensions to Monaco language IDs
function getMonacoLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    xml: 'xml',
    svg: 'xml',
    toml: 'ini',
    ini: 'ini',
    conf: 'ini',
    dockerfile: 'dockerfile',
    lua: 'lua',
    perl: 'perl',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    r: 'r',
    graphql: 'graphql',
    proto: 'protobuf',
  }
  // Handle special filenames
  const filename = filePath.split('/').pop()?.toLowerCase() || ''
  if (filename === 'dockerfile') return 'dockerfile'
  if (filename === 'makefile' || filename === 'gnumakefile') return 'makefile'
  if (filename.endsWith('.env') || filename.startsWith('.env')) return 'ini'
  if (filename === 'nginx.conf' || filePath.includes('nginx')) return 'ini'

  return langMap[ext] || 'plaintext'
}

function getLanguageLabel(filePath: string): string {
  const lang = getMonacoLanguage(filePath)
  const labels: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    ruby: 'Ruby',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    css: 'CSS',
    scss: 'SCSS',
    less: 'LESS',
    html: 'HTML',
    json: 'JSON',
    yaml: 'YAML',
    markdown: 'Markdown',
    shell: 'Shell',
    sql: 'SQL',
    xml: 'XML',
    ini: 'Config',
    dockerfile: 'Dockerfile',
    lua: 'Lua',
    perl: 'Perl',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    r: 'R',
    graphql: 'GraphQL',
    plaintext: 'Text',
  }
  return labels[lang] || lang
}

// ── Diff View Overlay ─────────────────────────────────────────────
interface DiffOverlayProps {
  filePath: string
  originalContent: string
  modifiedContent: string
  language: string
  isSaving: boolean
  onConfirm: () => void
  onCancel: () => void
}

function DiffOverlay({
  filePath,
  originalContent,
  modifiedContent,
  language,
  isSaving,
  onConfirm,
  onCancel,
}: DiffOverlayProps) {
  // Count changed lines for the summary badge
  const origLines = originalContent.split('\n')
  const modLines = modifiedContent.split('\n')

  return (
    <div style={diffStyles.overlay}>
      {/* Header */}
      <div style={diffStyles.header}>
        <div style={diffStyles.headerLeft}>
          <span style={diffStyles.headerIcon}><GitCompare size={16} /></span>
          <div>
            <div style={diffStyles.headerTitle}>Review Changes</div>
            <div style={diffStyles.headerPath}>{filePath}</div>
          </div>
        </div>
        <div style={diffStyles.headerMeta}>
          <span style={diffStyles.metaBadge}>
            {origLines.length} → {modLines.length} lines
          </span>
          <span style={{ ...diffStyles.metaBadge, color: 'var(--error)', borderColor: 'rgba(244,67,54,0.3)', background: 'rgba(244,67,54,0.08)' }}>
            Original
          </span>
          <span style={{ ...diffStyles.metaBadge, color: 'var(--success)', borderColor: 'rgba(76,175,80,0.3)', background: 'rgba(76,175,80,0.08)' }}>
            Modified
          </span>
        </div>
      </div>

      {/* Diff Editor */}
      <div style={diffStyles.editorWrap}>
        <DiffEditor
          original={originalContent}
          modified={modifiedContent}
          language={language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            padding: { top: 8, bottom: 8 },
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            renderIndicators: true,
            ignoreTrimWhitespace: false,
            diffWordWrap: 'off',
          }}
          loading={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '13px' }}>
              Loading diff...
            </div>
          }
        />
      </div>

      {/* Footer */}
      <div style={diffStyles.footer}>
        <div style={diffStyles.footerHint}>
          Review the changes above before saving to the remote server.
        </div>
        <div style={diffStyles.footerActions}>
          <button style={diffStyles.cancelBtn} onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button style={diffStyles.confirmBtn} onClick={onConfirm} disabled={isSaving}>
            {isSaving ? (
              'Saving...'
            ) : (
              <>
                <Check size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                Confirm & Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export function CodeEditor({
  connId,
  filePath,
  initialContent,
  onRequestOpen,
}: CodeEditorProps) {
  const [currentPath, setCurrentPath] = useState(filePath || '')
  const [content, setContent] = useState(initialContent || '')
  const [isModified, setIsModified] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorCol, setCursorCol] = useState(1)
  const [openPathInput, setOpenPathInput] = useState('')
  const [isOpening, setIsOpening] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [diffContent, setDiffContent] = useState('')  // snapshot of content when diff opened

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const savedContentRef = useRef(initialContent || '')
  const {
    editorFontSize,
    editorTabSize,
    editorWordWrap,
    editorMinimap,
    editorLigatures,
  } = useSettingsStore()

  // Update when a new file is passed in from the File Browser
  useEffect(() => {
    if (filePath && initialContent !== undefined) {
      setCurrentPath(filePath)
      setContent(initialContent)
      savedContentRef.current = initialContent
      setIsModified(false)
      setStatus('')
      setShowDiff(false)
    }
  }, [initialContent, filePath])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Add Ctrl+S keybinding → open diff view
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRequest()
    })

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber)
      setCursorCol(e.position.column)
    })

    editor.focus()
  }

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newContent = value ?? ''
      setContent(newContent)
      setIsModified(newContent !== savedContentRef.current)
    },
    []
  )

  // Called when user presses Save (Ctrl+S or button) — shows diff first
  const handleSaveRequest = () => {
    if (!currentPath || !isModified) return
    const currentContent = editorRef.current?.getValue() ?? content
    setDiffContent(currentContent)
    setShowDiff(true)
  }

  // Called after user confirms in diff view — actually writes the file
  const handleConfirmSave = async () => {
    setIsSaving(true)
    setStatus('Saving...')
    try {
      await window.api.sftp.writeFile(connId, currentPath, diffContent)
      savedContentRef.current = diffContent
      setContent(diffContent)
      setIsModified(false)
      setShowDiff(false)
      setStatus('Saved')
      setTimeout(() => setStatus(''), 2000)
    } catch (err: any) {
      setStatus(`Save failed: ${err.message}`)
      setShowDiff(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenRemote = async (pathToOpen?: string) => {
    const remotePath = (pathToOpen || openPathInput).trim()
    if (!remotePath) return

    setIsOpening(true)
    setStatus('Opening...')
    try {
      const fileContent = await window.api.sftp.readFile(connId, remotePath)
      setCurrentPath(remotePath)
      setContent(fileContent)
      savedContentRef.current = fileContent
      setIsModified(false)
      setOpenPathInput('')
      setStatus('')
      setShowDiff(false)
    } catch (err: any) {
      setStatus(`Open failed: ${err.message}`)
    } finally {
      setIsOpening(false)
    }
  }

  if (!currentPath) {
    return (
      <div style={styles.emptyState}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>
          {'\u{1F4DD}'}
        </div>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
          No File Open
        </h3>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '13px',
            marginBottom: '16px',
            maxWidth: '360px',
            textAlign: 'center' as const,
          }}
        >
          Open a file from the Files tab, or enter a remote path below.
        </p>
        <div style={styles.openPathRow}>
          <input
            style={styles.openPathInput}
            value={openPathInput}
            onChange={(e) => setOpenPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleOpenRemote()
            }}
            placeholder="/etc/nginx/nginx.conf"
            disabled={isOpening}
          />
          <button
            style={styles.openBtn}
            onClick={() => handleOpenRemote()}
            disabled={isOpening || !openPathInput.trim()}
          >
            {isOpening ? 'Opening...' : 'Open'}
          </button>
        </div>
        {status && (
          <div
            style={{
              marginTop: '12px',
              color: 'var(--error)',
              fontSize: '12px',
            }}
          >
            {status}
          </div>
        )}
      </div>
    )
  }

  const lineCount = editorRef.current?.getModel()?.getLineCount() ?? content.split('\n').length

  return (
    <div style={styles.container}>
      {/* Diff overlay — shown on top of editor when reviewing changes */}
      {showDiff && (
        <DiffOverlay
          filePath={currentPath}
          originalContent={savedContentRef.current}
          modifiedContent={diffContent}
          language={getMonacoLanguage(currentPath)}
          isSaving={isSaving}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowDiff(false)}
        />
      )}

      {/* Editor toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.fileInfo}>
          <span style={styles.filePath}>
            {currentPath}
            {isModified && <span style={styles.modifiedDot}> *</span>}
          </span>
          <span style={styles.language}>
            {getLanguageLabel(currentPath)}
          </span>
        </div>
        <div style={styles.toolbarActions}>
          {status && (
            <span style={{
              ...styles.status,
              color: status.startsWith('Save failed') ? 'var(--error)' : 'var(--success)',
            }}>
              {status}
            </span>
          )}
          <input
            style={styles.toolbarPathInput}
            value={openPathInput}
            onChange={(e) => setOpenPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleOpenRemote()
            }}
            placeholder="Open path..."
            disabled={isOpening}
          />
          <button
            style={styles.openPathBtn}
            onClick={() => handleOpenRemote()}
            disabled={isOpening || !openPathInput.trim()}
          >
            {isOpening ? '...' : 'Open'}
          </button>
          {isModified && (
            <button
              style={styles.diffBtn}
              onClick={handleSaveRequest}
              title="Preview changes before saving"
            >
              <GitCompare size={13} style={{ marginRight: '5px', verticalAlign: '-2px' }} />
              Diff
            </button>
          )}
          <button
            style={{
              ...styles.saveBtn,
              opacity: isModified ? 1 : 0.5,
            }}
            onClick={handleSaveRequest}
            disabled={!isModified || isSaving}
            title="Review changes and save (Ctrl+S)"
          >
            {isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={styles.editorArea}>
        <Editor
          language={getMonacoLanguage(currentPath)}
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            fontSize: editorFontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            fontLigatures: editorLigatures,
            minimap: { enabled: editorMinimap },
            scrollBeyondLastLine: false,
            wordWrap: editorWordWrap ? 'on' : 'off',
            tabSize: editorTabSize,
            insertSpaces: true,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 8, bottom: 8 },
            lineNumbersMinChars: 4,
            renderLineHighlight: 'all',
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
          loading={
            <div style={styles.loadingMsg}>Loading editor...</div>
          }
        />
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>
          Ln {cursorLine}, Col {cursorCol}
        </span>
        <span>Lines: {lineCount}</span>
        <span>{getLanguageLabel(currentPath)}</span>
        <span>UTF-8</span>
      </div>
    </div>
  )
}

// ── Editor Styles ─────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  filePath: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  modifiedDot: {
    color: 'var(--warning)',
    fontWeight: 'bold',
  },
  language: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '2px 8px',
    borderRadius: '10px',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  toolbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  status: {
    fontSize: '12px',
    color: 'var(--success)',
  },
  openPathRow: {
    display: 'flex',
    gap: '8px',
    width: '100%',
    maxWidth: '420px',
  },
  openPathInput: {
    flex: 1,
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  toolbarPathInput: {
    width: '180px',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  openPathBtn: {
    padding: '4px 12px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  diffBtn: {
    padding: '4px 12px',
    background: 'transparent',
    color: 'var(--warning)',
    border: '1px solid rgba(255, 152, 0, 0.4)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  saveBtn: {
    padding: '4px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  editorArea: {
    flex: 1,
    overflow: 'hidden',
  },
  statusBar: {
    display: 'flex',
    gap: '16px',
    padding: '4px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    flexShrink: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
  },
  openBtn: {
    padding: '8px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  loadingMsg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
}

// ── Diff Overlay Styles ───────────────────────────────────────────
const diffStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    borderRadius: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    gap: '12px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  headerIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--warning)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  headerPath: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  metaBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    whiteSpace: 'nowrap' as const,
  },
  editorWrap: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    gap: '12px',
  },
  footerHint: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  footerActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '6px 16px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '6px 18px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
}
