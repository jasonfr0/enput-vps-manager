import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface TerminalViewProps {
  connId: string
}

export function TerminalView({ connId }: TerminalViewProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!termRef.current) return

    // Create terminal
    const terminal = new Terminal({
      theme: {
        background: '#1a1b2e',
        foreground: '#e8e9f0',
        cursor: '#6c63ff',
        cursorAccent: '#1a1b2e',
        selectionBackground: 'rgba(108, 99, 255, 0.3)',
        black: '#1a1b2e',
        red: '#f44336',
        green: '#4caf50',
        yellow: '#ff9800',
        blue: '#6c63ff',
        magenta: '#e040fb',
        cyan: '#00bcd4',
        white: '#e8e9f0',
        brightBlack: '#6b6c80',
        brightRed: '#ff5252',
        brightGreen: '#69f0ae',
        brightYellow: '#ffd740',
        brightBlue: '#7d75ff',
        brightMagenta: '#ff80ab',
        brightCyan: '#84ffff',
        brightWhite: '#ffffff',
      },
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(termRef.current)
    fitAddon.fit()

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

    // Handle user input
    terminal.onData((data) => {
      if (shellIdRef.current) {
        window.api.terminal.write(connId, shellIdRef.current, data)
      }
    })

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
      if (shellIdRef.current) {
        window.api.terminal.resize(
          connId,
          shellIdRef.current,
          terminal.cols,
          terminal.rows
        )
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(termRef.current)

    // Listen for shell output
    const unsubOutput = window.api.terminal.onOutput(({ shellId, data }) => {
      if (shellId === shellIdRef.current) {
        terminal.write(data)
      }
    })

    return () => {
      unsubOutput()
      resizeObserver.disconnect()
      if (shellIdRef.current) {
        window.api.terminal.close(connId, shellIdRef.current)
      }
      terminal.dispose()
    }
  }, [connId])

  return (
    <div style={styles.container}>
      <div ref={termRef} style={styles.terminal} />
      {!isReady && (
        <div style={styles.loading}>
          <span>Connecting to shell...</span>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    position: 'relative',
    background: '#1a1b2e',
  },
  terminal: {
    height: '100%',
    padding: '4px',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(26, 27, 46, 0.9)',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
}
