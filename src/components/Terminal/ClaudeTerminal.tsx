import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettingsStore } from '../../context/useSettingsStore'

interface ClaudeTerminalProps {
  connId: string
}

export function ClaudeTerminal({ connId }: ClaudeTerminalProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef = useRef<string | null>(null)
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
        selectionBackground: 'rgba(212, 165, 116, 0.3)',
        black: '#1a1a2e',
        red: '#f44336',
        green: '#4caf50',
        yellow: '#ff9800',
        blue: '#6c63ff',
        magenta: '#d4a574',
        cyan: '#00bcd4',
        white: '#e8e9f0',
        brightBlack: '#6b6c80',
        brightRed: '#ff5252',
        brightGreen: '#69f0ae',
        brightYellow: '#ffd740',
        brightBlue: '#7d75ff',
        brightMagenta: '#e8c49a',
        brightCyan: '#84ffff',
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

    // Double-rAF ensures the browser has finished a full layout pass before
    // fitting, so xterm gets real pixel dimensions instead of 0×0.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitAddon.fit()
      })
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Ctrl+Shift+Up/Down → scroll scrollback (works even in mouse-tracking mode)
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.shiftKey && e.type === 'keydown') {
        if (e.key === 'ArrowUp')   { terminal.scrollLines(-5);  return false }
        if (e.key === 'ArrowDown') { terminal.scrollLines(5);   return false }
        if (e.key === 'Home')      { terminal.scrollToTop();    return false }
        if (e.key === 'End')       { terminal.scrollToBottom(); return false }
      }
      return true
    })

    // Wheel handler on the wrapper — guarantees scrolling works even when
    // Claude Code has enabled mouse-tracking (which causes xterm to forward
    // wheel events to the pty instead of scrolling the viewport).
    const wrapper = wrapperRef.current
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const lines = Math.round(e.deltaY / 25) || (e.deltaY > 0 ? 1 : -1)
      terminal.scrollLines(lines)
    }
    wrapper.addEventListener('wheel', handleWheel, { passive: false })

    // Handle user input
    terminal.onData((data) => {
      if (shellIdRef.current) {
        window.api.terminal.write(connId, shellIdRef.current, data)
      }
    })

    // Resize observer — observe the WRAPPER (the bounded flex element),
    // not the terminal div (which is absolutely positioned inside it).
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    })
    resizeObserver.observe(wrapper)

    // Track claude detection across output events (closure variable, not state)
    let outputBuffer = ''
    let hasChecked = false

    // Output listener — installed before the shell is created so no data is lost
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

    // Shell init — hidden behind the loading overlay while the SSH banner arrives
    const initClaudeShell = async () => {
      try {
        setLoadingMsg('Connecting to VPS…')
        const { cols, rows } = terminal
        const { shellId } = await window.api.terminal.create(connId, cols, rows)
        shellIdRef.current = shellId

        // Give the SSH banner ~700 ms to fully arrive, then wipe it so the
        // user sees a clean Claude Code terminal instead of MOTD noise.
        setLoadingMsg('Starting Claude Code…')
        await new Promise<void>((resolve) => setTimeout(resolve, 700))
        terminal.reset()     // clears viewport + scrollback (goodbye, banner)

        // reset() wipes xterm's internal dimension state — re-fit so the
        // terminal knows how many cols/rows it actually has.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => { requestAnimationFrame(() => { fitAddon.fit(); resolve() }) })
        })

        // Now reveal the terminal
        setIsReady(true)

        terminal.writeln('\x1b[1;33m=== Claude Code Terminal ===\x1b[0m')
        terminal.writeln('\x1b[2mChecking if Claude Code CLI is installed…\x1b[0m\r\n')
        setClaudeStatus('checking')

        window.api.terminal.write(
          connId,
          shellId,
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
      wrapper.removeEventListener('wheel', handleWheel)
      resizeObserver.disconnect()
      if (shellIdRef.current) {
        window.api.terminal.close(connId, shellIdRef.current)
      }
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
    <div style={styles.container}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.claudeIcon}>✨</span>
          <span style={styles.topBarTitle}>Claude Code</span>
          <span style={{
            ...styles.statusBadge,
            background:
              claudeStatus === 'running'    ? 'var(--success)'    :
              claudeStatus === 'not-installed' ? 'var(--warning)' :
              claudeStatus === 'error'      ? 'var(--error)'      :
              'var(--text-muted)',
          }}>
            {claudeStatus === 'checking'      ? 'Checking…'       :
             claudeStatus === 'not-installed' ? 'Not Installed'   :
             claudeStatus === 'launching'     ? 'Launching…'      :
             claudeStatus === 'running'       ? 'Running'         :
             'Error'}
          </span>
        </div>
        <div style={styles.topBarActions}>
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

      {/* Terminal area — wrapper is the bounded flex element, terminal fills it */}
      <div style={styles.terminalWrapper} ref={wrapperRef}>
        <div ref={termRef} style={styles.terminal} />

        {/* Loading overlay — hides SSH banner until we've cleared it */}
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
  container: {
    height: '100%',
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
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  claudeIcon: { fontSize: '14px' },
  topBarTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  topBarActions: { display: 'flex', gap: '6px' },
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
  // Wrapper is the bounded flex element — clips overflow visually, but does
  // NOT set overflow on the terminal div itself so xterm's .xterm-viewport
  // scrollbar stays interactive.
  terminalWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 0,
  },
  // Terminal fills wrapper exactly via absolute positioning.
  // NO overflow:hidden — xterm needs its .xterm-viewport overflow-y:scroll.
  terminal: {
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
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
}
