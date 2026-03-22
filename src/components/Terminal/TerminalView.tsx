import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettingsStore } from '../../context/useSettingsStore'

interface TerminalViewProps {
  connId: string
}

export function TerminalView({ connId }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef    = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef  = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink } = useSettingsStore()

  useEffect(() => {
    if (!termRef.current || !containerRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#1a1b2e',
        foreground: '#e8e9f0',
        cursor: '#6c63ff',
        cursorAccent: '#1a1b2e',
        selectionBackground: 'rgba(108, 99, 255, 0.3)',
        black: '#1a1b2e',  red: '#f44336',    green: '#4caf50',
        yellow: '#ff9800', blue: '#6c63ff',   magenta: '#e040fb',
        cyan: '#00bcd4',   white: '#e8e9f0',  brightBlack: '#6b6c80',
        brightRed: '#ff5252',    brightGreen: '#69f0ae',
        brightYellow: '#ffd740', brightBlue: '#7d75ff',
        brightMagenta: '#ff80ab',brightCyan: '#84ffff',
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

    // Create SSH shell
    const initShell = async () => {
      try {
        const { cols, rows } = terminal
        const { shellId } = await window.api.terminal.create(connId, cols, rows)
        shellIdRef.current = shellId
        setIsReady(true)
        terminal.writeln('\x1b[1;34m=== Connected to VPS ===\x1b[0m\r\n')
      } catch (err: any) {
        terminal.writeln(`\x1b[1;31mFailed to create shell: ${err.message}\x1b[0m`)
      }
    }
    initShell()

    terminal.onData((data) => {
      if (shellIdRef.current) {
        window.api.terminal.write(connId, shellIdRef.current, data)
      }
    })

    // Observe the container (which is bounded), not the termRef div.
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    })
    resizeObserver.observe(containerRef.current!)

    const unsubOutput = window.api.terminal.onOutput(({ shellId, data }) => {
      if (shellId === shellIdRef.current) terminal.write(data)
    })

    return () => {
      unsubOutput()
      resizeObserver.disconnect()
      if (shellIdRef.current) window.api.terminal.close(connId, shellIdRef.current)
      terminal.dispose()
    }
  }, [connId, terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink])

  return (
    // Root fills .tab-content exactly via position:absolute so there is no
    // ambiguity about what "100%" means — the layout never expands with content.
    <div ref={containerRef} style={styles.root}>
      <div ref={termRef} style={styles.term} />
      {!isReady && (
        <div style={styles.loading}>
          <span>Connecting to shell...</span>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  // Fills .tab-content (position:relative) exactly. Nothing here can grow.
  root: {
    position: 'absolute',
    inset: 0,
    background: '#1a1b2e',
    overflow: 'hidden',
  },
  // The div passed to terminal.open(). Must NOT have overflow:hidden —
  // xterm's .xterm-viewport (overflow-y:scroll) manages its own clipping.
  // position:absolute + inset:0 pins it to the root bounds.
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
    background: 'rgba(26,27,46,0.9)',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
}
