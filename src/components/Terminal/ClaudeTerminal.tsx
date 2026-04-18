import React, { useLayoutEffect, useRef, useState, useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettingsStore } from '../../context/useSettingsStore'

interface ClaudeTerminalProps {
  connId: string
  /** When true, this tab is currently visible — triggers a refit after being hidden */
  isActive?: boolean
}

interface DirEntry {
  name: string
  path: string
  type: string
}

export function ClaudeTerminal({ connId, isActive = true }: ClaudeTerminalProps) {
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const termRef     = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef  = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink } = useSettingsStore()
  const [claudeStatus, setClaudeStatus] = useState<
    'checking' | 'ready' | 'not-installed' | 'launching' | 'running' | 'error'
  >('checking')
  const [loadingMsg, setLoadingMsg] = useState('Connecting to VPS…')

  // Working directory — editable before Claude launches, read-only once running.
  // workingDirRef keeps the closure in useLayoutEffect in sync with the latest value.
  const [workingDir, setWorkingDir] = useState('~')
  const workingDirRef = useRef('~')
  const handleDirChange = (v: string) => { setWorkingDir(v); workingDirRef.current = v }

  // ── Directory picker state ────────────────────────────────────────────────
  const [pickerOpen,    setPickerOpen]    = useState(false)
  const [pickerPath,    setPickerPath]    = useState('/')
  const [pickerEntries, setPickerEntries] = useState<DirEntry[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError,   setPickerError]   = useState('')

  const openPicker = async () => {
    // Start at the current workingDir, resolving '~' to '/'
    const startPath = workingDirRef.current === '~' ? '/' : workingDirRef.current
    setPickerOpen(true)
    await loadPickerDir(startPath)
  }

  const loadPickerDir = async (path: string) => {
    setPickerLoading(true)
    setPickerError('')
    setPickerPath(path)
    try {
      const entries: DirEntry[] = await window.api.sftp.listDir(connId, path)
      setPickerEntries(
        entries
          .filter(e => e.type === 'directory' && e.name !== '.')
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    } catch (err: any) {
      setPickerError(err.message || 'Failed to list directory')
    } finally {
      setPickerLoading(false)
    }
  }

  const pickerNavigate = (path: string) => loadPickerDir(path)

  const pickerUp = () => {
    if (pickerPath === '/') return
    const parent = pickerPath.split('/').slice(0, -1).join('/') || '/'
    loadPickerDir(parent)
  }

  const pickerSelect = () => {
    handleDirChange(pickerPath)
    setPickerOpen(false)
  }

  // Breadcrumb segments for the picker header
  const pickerSegments = pickerPath === '/'
    ? [{ label: '/', path: '/' }]
    : [{ label: '/', path: '/' }, ...pickerPath.split('/').filter(Boolean).map((seg, i, arr) => ({
        label: seg,
        path: '/' + arr.slice(0, i + 1).join('/'),
      }))]

  // useLayoutEffect fires synchronously after the DOM is mutated but BEFORE
  // the browser paints. We defer the first syncSize() to a requestAnimationFrame
  // so the browser's flex layout is fully resolved before FitAddon measures
  // the container. This matches the timing used by the ResizeObserver
  // (which is why minimize→maximize always corrects the size).
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const termEl  = termRef.current
    if (!wrapper || !termEl) return

    const terminal = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e8e9f0',
        cursor: '#d4a574',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(212,165,116,0.3)',
        black: '#1a1a2e',  red: '#f44336',    green: '#4caf50',
        yellow: '#ff9800', blue: '#6c63ff',   magenta: '#d4a574',
        cyan: '#00bcd4',   white: '#e8e9f0',  brightBlack: '#6b6c80',
        brightRed: '#ff5252',    brightGreen: '#69f0ae',
        brightYellow: '#ffd740', brightBlue: '#7d75ff',
        brightMagenta: '#e8c49a',brightCyan: '#84ffff',
        brightWhite: '#ffffff',
      },
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      fontSize: terminalFontSize,
      lineHeight: 1.2,
      cursorBlink: terminalCursorBlink,
      cursorStyle: terminalCursorStyle,
      scrollback: 0,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(termEl)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // ── Scroll helper ─────────────────────────────────────────────────────
    const scrollToBottom = () => {
      const vp = termEl.querySelector('.xterm-viewport') as HTMLElement | null
      if (vp) vp.scrollTop = vp.scrollHeight
      terminal.scrollToBottom()
    }

    // ── Size sync ─────────────────────────────────────────────────────────
    const syncSize = () => {
      const rect = wrapper.getBoundingClientRect()
      if (rect.width <= 0) return
      const h = Math.max(1, Math.floor(window.innerHeight - rect.top))
      termEl.style.height = `${h}px`
      fitAddon.fit()
      scrollToBottom()
      requestAnimationFrame(scrollToBottom)
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    }

    // Defer the initial fit to the next animation frame so the browser has
    // fully resolved flex layout (the same timing path ResizeObserver uses,
    // which is why minimize→maximize always fixes sizing).
    requestAnimationFrame(syncSize)

    // Re-fit whenever the wrapper changes size (window resize, etc.)
    const ro = new ResizeObserver(syncSize)
    ro.observe(wrapper)

    // ── Input ─────────────────────────────────────────────────────────────
    terminal.onData((data) => {
      if (shellIdRef.current) window.api.terminal.write(connId, shellIdRef.current, data)
    })

    // ── Output ────────────────────────────────────────────────────────────
    let outputBuffer = ''
    let hasChecked = false

    const unsubOutput = window.api.terminal.onOutput(({ shellId, data }: { shellId: string; data: string }) => {
      if (shellId !== shellIdRef.current) return
      terminal.write(data, () => requestAnimationFrame(scrollToBottom))
      if (!hasChecked) {
        outputBuffer += data
        if (outputBuffer.includes('CLAUDE_FOUND')) {
          hasChecked = true
          // Don't auto-launch — let the user pick a working directory first
          setClaudeStatus('ready')
          terminal.writeln('\r\n\x1b[1;32m✓ Claude Code is installed.\x1b[0m')
          terminal.writeln('\x1b[2mSelect a working directory above, then click \x1b[0m\x1b[1mLaunch Claude\x1b[0m\x1b[2m.\x1b[0m\r\n')
        } else if (outputBuffer.includes('CLAUDE_NOT_FOUND')) {
          hasChecked = true
          setClaudeStatus('not-installed')
          terminal.writeln('')
          terminal.writeln('\x1b[1;33mClaude Code is not installed on this VPS.\x1b[0m')
          terminal.writeln('\x1b[2mTo install it, run:\x1b[0m')
          terminal.writeln('\x1b[1;36m  npm install -g @anthropic-ai/claude-code\x1b[0m')
          terminal.writeln('')
          terminal.writeln('\x1b[2mYou can use this terminal normally in the meantime.\x1b[0m\r\n')
        }
      }
    })

    // ── Shell init ────────────────────────────────────────────────────────
    const initClaudeShell = async () => {
      try {
        setLoadingMsg('Connecting to VPS…')
        const { cols, rows } = terminal
        const { shellId } = await window.api.terminal.create(connId, cols, rows)
        shellIdRef.current = shellId

        setLoadingMsg('Starting Claude Code…')
        await new Promise<void>((resolve) => setTimeout(resolve, 700))
        terminal.reset()

        fitAddon.fit()
        await new Promise<void>((resolve) => requestAnimationFrame(() => { scrollToBottom(); resolve() }))

        setIsReady(true)
        terminal.writeln('\x1b[1;33m=== Claude Code Terminal ===\x1b[0m')
        terminal.writeln('\x1b[2mChecking if Claude Code CLI is installed…\x1b[0m\r\n')
        setClaudeStatus('checking')
        window.api.terminal.write(
          connId, shellId,
          'which claude && echo "CLAUDE_FOUND" || echo "CLAUDE_NOT_FOUND"\n'
        )
      } catch (err: any) {
        setIsReady(true)
        terminal.writeln(`\x1b[1;31mFailed to create shell: ${err.message}\x1b[0m`)
        setClaudeStatus('error')
      }
    }
    initClaudeShell()

    return () => {
      unsubOutput()
      ro.disconnect()
      if (shellIdRef.current) window.api.terminal.close(connId, shellIdRef.current)
      terminal.dispose()
    }
  }, [connId, terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink])

  // Resync PTY size when switching back to this tab
  useLayoutEffect(() => {
    if (!isActive) return
    const fitAddon = fitAddonRef.current
    const terminal = terminalRef.current
    if (!fitAddon || !terminal) return
    requestAnimationFrame(() => {
      fitAddon.fit()
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    })
  }, [isActive, connId])

  const handleInstallClaude = () => {
    if (!shellIdRef.current) return
    window.api.terminal.write(connId, shellIdRef.current, 'npm install -g @anthropic-ai/claude-code\n')
    setClaudeStatus('checking')
  }

  const handleLaunchClaude = () => {
    if (!shellIdRef.current) return
    const dir = workingDirRef.current || '~'
    window.api.terminal.write(connId, shellIdRef.current, `cd ${dir} && claude\n`)
    setClaudeStatus('running')
  }

  const isRunning = claudeStatus === 'running'

  return (
    <div style={styles.root}>
      {/* ── Top bar ── */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={{ fontSize: '14px' }}>✨</span>
          <span style={styles.topBarTitle}>Claude Code</span>
          <span style={{
            ...styles.statusBadge,
            background:
              claudeStatus === 'running'       ? 'var(--success)' :
              claudeStatus === 'ready'         ? 'var(--accent)'  :
              claudeStatus === 'not-installed' ? 'var(--warning)' :
              claudeStatus === 'error'         ? 'var(--error)'   :
              'var(--text-muted)',
          }}>
            {claudeStatus === 'checking'      ? 'Checking…'     :
             claudeStatus === 'ready'         ? 'Ready'         :
             claudeStatus === 'not-installed' ? 'Not Installed'  :
             claudeStatus === 'launching'     ? 'Launching…'    :
             claudeStatus === 'running'       ? 'Running'       : 'Error'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {claudeStatus === 'not-installed' && (
            <button style={styles.actionBtn} onClick={handleInstallClaude}>
              Install Claude Code
            </button>
          )}
          {claudeStatus === 'ready' && (
            <button style={styles.actionBtn} onClick={handleLaunchClaude}>
              Launch Claude ✨
            </button>
          )}
          {(claudeStatus === 'not-installed' || claudeStatus === 'checking') && (
            <button style={{ ...styles.actionBtn, background: 'var(--bg-tertiary)' }} onClick={handleLaunchClaude}>
              Launch claude
            </button>
          )}
        </div>
      </div>

      {/* ── Directory bar ── */}
      <div style={styles.dirBar}>
        <span style={styles.dirLabel}>
          {isRunning ? 'Launched in:' : 'Working directory:'}
        </span>
        <input
          style={{ ...styles.dirInput, ...(isRunning ? styles.dirInputReadonly : {}) }}
          value={workingDir}
          readOnly={isRunning}
          onChange={e => handleDirChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          placeholder="~ (home directory)"
          spellCheck={false}
        />
        {!isRunning && (
          <button style={styles.browseBtn} onClick={openPicker} title="Browse directories">
            📂
          </button>
        )}
      </div>

      {/* ── Terminal + picker overlay ── */}
      <div ref={wrapperRef} style={styles.termWrapper}>
        <div ref={termRef} style={styles.term} />

        {!isReady && (
          <div style={styles.loading}>
            <div style={styles.loadingDot} />
            <span>{loadingMsg}</span>
          </div>
        )}

        {/* Directory picker panel */}
        {pickerOpen && (
          <div style={styles.picker}>
            {/* Picker header / breadcrumb */}
            <div style={styles.pickerHeader}>
              <div style={styles.pickerBreadcrumb}>
                {pickerSegments.map((seg, i) => (
                  <React.Fragment key={seg.path}>
                    {i > 0 && <span style={styles.pickerSep}>/</span>}
                    <button
                      style={{
                        ...styles.pickerCrumb,
                        ...(i === pickerSegments.length - 1 ? styles.pickerCrumbActive : {}),
                      }}
                      onClick={() => pickerNavigate(seg.path)}
                    >
                      {seg.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={styles.pickerUpBtn} onClick={pickerUp} disabled={pickerPath === '/'} title="Go up">
                  ↑ Up
                </button>
                <button style={{ ...styles.actionBtn, background: 'var(--accent)' }} onClick={pickerSelect}>
                  Select
                </button>
                <button style={{ ...styles.actionBtn, background: 'var(--bg-tertiary)' }} onClick={() => setPickerOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>

            {/* Picker body */}
            <div style={styles.pickerBody}>
              {pickerLoading && (
                <div style={styles.pickerStatus}>Loading…</div>
              )}
              {!pickerLoading && pickerError && (
                <div style={{ ...styles.pickerStatus, color: 'var(--error)' }}>{pickerError}</div>
              )}
              {!pickerLoading && !pickerError && pickerEntries.length === 0 && (
                <div style={styles.pickerStatus}>No subdirectories</div>
              )}
              {!pickerLoading && pickerEntries.map(entry => (
                <button
                  key={entry.path}
                  style={styles.pickerEntry}
                  onClick={() => pickerNavigate(entry.path)}
                  onDoubleClick={pickerSelect}
                  title={`Double-click to select ${entry.path}`}
                >
                  <span style={{ marginRight: 6 }}>📁</span>
                  {entry.name}
                </button>
              ))}
            </div>

            <div style={styles.pickerFooter}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                Double-click a folder to select it, or navigate then click Select
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#1a1a2e',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  topBarTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  statusBadge: {
    fontSize: '10px', fontWeight: 600, color: '#fff',
    padding: '2px 8px', borderRadius: '10px',
  },
  actionBtn: {
    padding: '4px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },

  // ── Directory bar ──────────────────────────────────────────────────────────
  dirBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    flexShrink: 0,
  },
  dirLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  dirInput: {
    flex: 1,
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    padding: '3px 8px',
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
    outline: 'none',
    minWidth: 0,
  },
  dirInputReadonly: {
    opacity: 0.6,
    cursor: 'default',
  },
  browseBtn: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    lineHeight: 1,
    flexShrink: 0,
  },

  // ── Terminal wrapper ───────────────────────────────────────────────────────
  termWrapper: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  term: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    // height set imperatively by syncSize — no bottom/inset so JS height wins
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: '#1a1a2e',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  loadingDot: {
    width: 8, height: 8,
    borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'pulse 1.4s ease-in-out infinite',
  },

  // ── Directory picker ───────────────────────────────────────────────────────
  picker: {
    position: 'absolute',
    inset: 0,
    background: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
    border: '1px solid var(--border)',
  },
  pickerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    gap: '12px',
    flexShrink: 0,
  },
  pickerBreadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flex: 1,
    overflow: 'hidden',
    flexWrap: 'wrap',
  },
  pickerCrumb: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '3px',
    fontFamily: "'Cascadia Code', monospace",
  },
  pickerCrumbActive: {
    color: 'var(--text-primary)',
    cursor: 'default',
    fontWeight: 600,
  },
  pickerSep: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    userSelect: 'none',
  },
  pickerUpBtn: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  pickerBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px',
  },
  pickerStatus: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    padding: '16px',
    textAlign: 'center',
  },
  pickerEntry: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '13px',
    padding: '6px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  pickerFooter: {
    padding: '6px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    flexShrink: 0,
  },
}
