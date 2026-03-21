import React, { useState, useRef, useEffect } from 'react'

interface CodeEditorProps {
  connId: string
  filePath?: string
  initialContent?: string
}

export function CodeEditor({ connId, filePath, initialContent }: CodeEditorProps) {
  const [content, setContent] = useState(initialContent || '')
  const [isModified, setIsModified] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [lineCount, setLineCount] = useState(1)
  const [cursorLine, setCursorLine] = useState(1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialContent !== undefined) {
      setContent(initialContent)
      setIsModified(false)
      setLineCount(initialContent.split('\n').length)
    }
  }, [initialContent, filePath])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    setIsModified(true)
    setLineCount(newContent.split('\n').length)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab key inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue =
        content.substring(0, start) + '  ' + content.substring(end)
      setContent(newValue)
      setIsModified(true)

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }

    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  const handleCursorMove = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const text = content.substring(0, textarea.selectionStart)
    const line = text.split('\n').length
    setCursorLine(line)
  }

  const handleSave = async () => {
    if (!filePath || !isModified) return

    setIsSaving(true)
    setStatus('Saving...')
    try {
      await window.api.sftp.writeFile(connId, filePath, content)
      setIsModified(false)
      setStatus('Saved')
      setTimeout(() => setStatus(''), 2000)
    } catch (err: any) {
      setStatus(`Save failed: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpen = async () => {
    // Open a file dialog, then read and load
    const result = await window.api.dialog.openFile({
      title: 'Open Remote File',
    })
    if (result.canceled) return

    // This would need a "remote file picker" in the future
    // For now, let users type a path
    const remotePath = prompt('Enter remote file path:')
    if (!remotePath) return

    try {
      const fileContent = await window.api.sftp.readFile(connId, remotePath)
      setContent(fileContent)
      setIsModified(false)
      setLineCount(fileContent.split('\n').length)
    } catch (err: any) {
      setStatus(`Open failed: ${err.message}`)
    }
  }

  const getLanguage = (): string => {
    if (!filePath) return 'text'
    const ext = filePath.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      js: 'JavaScript',
      ts: 'TypeScript',
      tsx: 'TypeScript React',
      jsx: 'JavaScript React',
      py: 'Python',
      rb: 'Ruby',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      h: 'C/C++ Header',
      css: 'CSS',
      html: 'HTML',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      md: 'Markdown',
      sh: 'Shell',
      bash: 'Bash',
      sql: 'SQL',
      xml: 'XML',
      toml: 'TOML',
      conf: 'Config',
      nginx: 'Nginx',
    }
    return langMap[ext || ''] || 'Text'
  }

  if (!filePath) {
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
          }}
        >
          Open a file from the File Manager, or type a remote path.
        </p>
        <button style={styles.openBtn} onClick={handleOpen}>
          Open Remote File
        </button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Editor toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.fileInfo}>
          <span style={styles.filePath}>
            {filePath}
            {isModified && <span style={styles.modifiedDot}> *</span>}
          </span>
          <span style={styles.language}>{getLanguage()}</span>
        </div>
        <div style={styles.toolbarActions}>
          {status && <span style={styles.status}>{status}</span>}
          <button
            style={{
              ...styles.saveBtn,
              opacity: isModified ? 1 : 0.5,
            }}
            onClick={handleSave}
            disabled={!isModified || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div style={styles.editorArea}>
        {/* Line numbers */}
        <div style={styles.lineNumbers}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i + 1}
              style={{
                ...styles.lineNumber,
                color:
                  i + 1 === cursorLine
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorMove}
          onKeyUp={handleCursorMove}
          style={styles.textarea}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>
          Ln {cursorLine}, Lines {lineCount}
        </span>
        <span>{getLanguage()}</span>
        <span>UTF-8</span>
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
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  filePath: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-primary)',
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
  },
  toolbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  status: {
    fontSize: '12px',
    color: 'var(--success)',
  },
  saveBtn: {
    padding: '4px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  editorArea: {
    flex: 1,
    display: 'flex',
    overflow: 'auto',
    background: 'var(--bg-primary)',
  },
  lineNumbers: {
    width: '50px',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    padding: '8px 0',
    overflow: 'hidden',
    flexShrink: 0,
    userSelect: 'none' as const,
  },
  lineNumber: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '20px',
    textAlign: 'right' as const,
    paddingRight: '12px',
  },
  textarea: {
    flex: 1,
    resize: 'none' as const,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '20px',
    padding: '8px 12px',
    tabSize: 2,
    whiteSpace: 'pre' as const,
    overflowWrap: 'normal' as const,
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
}
