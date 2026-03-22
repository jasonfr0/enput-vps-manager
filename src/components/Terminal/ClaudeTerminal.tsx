import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettingsStore } from '../../context/useSettingsStore'

interface ClaudeTerminalProps {
  connId: string
}

export function ClaudeTerminal({ connId }: ClaudeTerminalProps) {
  const rootRef    = useRef<HTMLDivElement>(null)
  const termRef    = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef  = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink } = useSettingsStore()
  const [claudeStatus, setClaudeStatus] = useState<
    'checking' | 'not-installed' | 'launching' | 'running' | 'error'
  >('checking')
  const [loadingMsg, setLoadingMsg] = useState('Connecting to VPS…')

  useEffect(() => {
    if (!termRef.current || !wrapperRef.current) return

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
      scrollback: terminalScrollback,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(termRef.current)

    // Wait for a full layout pass so the container has real pixel dimensions.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitAddon.fit()
      })
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.onData((data) => {
      if (shellIdRef.current) {
        window.api.terminal.write(connId, shellIdRef.current, data)
      }
    })

    // Observe the wrapper div — it is the bounded element whose size
    // is determined by flex layout, not by xterm content.
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    })
    resizeObserver.observe(wrapperRef.current!)

    let outputBuffer = ''
    let hasChecked = false

    const unsubOutput = window.api.terminal.onOutput(({ shellId, data }: { shellId: string; data: string }) => {
      if (shellId !== shellIdRef.current) return
      terminal.write(data)
      if (!hasChecked) {
        outputBuffer += data
        if (outputBuffer.includes('CLAUDE_FOUND')) {
          hasChecked = true
          setClaudeStatus('launching')
          setTimeout(() => {
            window.api.terminal.write(connId, shellIdRef.current!, 'claude\n')
            setClaudeStatus('running')
          }, 300)
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

    const initClaudeShell = async () => {
      try {
        setLoadingMsg('Connecting to VPS…')
        const { cols, rows } = terminal
        const { shellId } = await window.api.terminal.create(connId, cols, rows)
        shellIdRef.current = shellId

        setLoadingMsg('Starting Claude Code…')
        await new Promise<void>((resolve) => setTimeout(resolve, 700))
        terminal.reset()

        // reset() wipes xterm's dimension state — re-fit after a layout pass.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => { requestAnimationFrame(() => { fitAddon.fit(); resolve() }) })
        })

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
      resizeObserver.disconnect()
      if (shellIdRef.current) window.api.terminal.close(connId, shellIdRef.current)
      terminal.dispose()
    }
  }, [connId, terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink])

  const handleInstallClaude = () => {
    if (!shellIdRef.current) return
    window.api.terminal.write(connId, shellIdRef.current, 'npm install -g @anthropic-ai/claude-code\n')
    setClaudeStatus('checking')
  }

  const handleLaunchClaude = () => {
    if (!shellIdRef.current) return
    window.api.terminal.write(connId, shellIdRef.current, 'claude\n')
    setClaudeStatus('running')
  }

  return (
    // Root fills .tab-content (position:relative) exactly.
    <div ref={rootRef} style={styles.root}>
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={{ fontSize: '14px' }}>✨</span>
          <span style={styles.topBarTitle}>Claude Code</span>
          <span style={{
            ...styles.statusBadge,
            background:
              claudeStatus === 'running'       ? 'var(--success)'  :
              claudeStatus === 'not-installed' ? 'var(--warning)'  :
              claudeStatus === 'error'         ? 'var(--error)'    :
              'var(--text-muted)',
          }}>
            {claudeStatus === 'checking'      ? 'Checking…'    :
             claudeStatus === 'not-installed' ? 'Not Installed' :
             claudeStatus === 'launching'     ? 'Launching…'   :
             claudeStatus === 'running'       ? 'Running'      : 'Error'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {claudeStatus === 'not-installed' && (
            <button style={styles.actionBtn} onClick={handleInstallClaude}>
              Install Claude Code
            </button>
          )}
          {(claudeStatus === 'not-installed' || claudeStatus === 'checking') && (
            <button style={{ ...styles.actionBtn, background: 'var(--bg-tertiary)' }} onClick={handleLaunchClaude}>
              Launch claude
            </button>
          )}
        </div>
      </div>

      {/* wrapperRef is the bounded flex element that ResizeObserver watches.
          overflow:hidden clips xterm visually. The termRef div inside is
          position:absolute so xterm fills the wrapper exactly. */}
      <div ref={wrapperRef} style={styles.termWrapper}>
        <div ref={termRef} style={styles.term} />
        {!isReady && (
          <div style={styles.loading}>
            <div style={styles.loadingDot} />
            <span>{loadingMsg}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  // Fills .tab-content (position:relative) exactly via absolute positioning.
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a2e',
    overflow: 'hidden',
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
  // flex:1 + minHeight:0 lets this fill remaining root height without growing.
  // overflow:hidden clips xterm visually; position:relative anchors the
  // absolutely-positioned term div and loading overlay.
  termWrapper: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  // The div passed to terminal.open(). position:absolute + inset:0 pins it
  // exactly to termWrapper's pixel bounds. NO overflow:hidden — xterm's own
  // .xterm-viewport (overflow-y:scroll) handles clipping and scrolling.
  term: {
    position: 'absolute',
    inset: 0,
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
}
