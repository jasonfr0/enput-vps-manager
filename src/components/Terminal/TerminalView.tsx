import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettingsStore } from '../../context/useSettingsStore'

interface TerminalViewProps {
  connId: string
}

export function TerminalView({ connId }: TerminalViewProps) {
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const termRef     = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef  = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink } = useSettingsStore()

  useEffect(() => {
    const wrapper = wrapperRef.current
    const termEl  = termRef.current
    if (!wrapper || !termEl) return

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
    terminal.open(termEl)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // ── Size sync ──────────────────────────────────────────────────────────
    // Measure the wrapper's actual pixel bounds and stamp those exact
    // dimensions onto the terminal div. FitAddon then reads those explicit
    // pixels and calculates the correct rows/cols. This avoids every CSS
    // percentage / flex / absolute-positioning height-chain issue.
    const syncSize = () => {
      const { width, height } = wrapper.getBoundingClientRect()
      if (width === 0 || height === 0) return          // not laid out yet
      termEl.style.width  = `${Math.floor(width)}px`
      termEl.style.height = `${Math.floor(height)}px`
      fitAddon.fit()
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    }

    // Initial fit — wait for two frames so the flex layout is done.
    requestAnimationFrame(() => requestAnimationFrame(syncSize))

    // Re-fit whenever the wrapper resizes (window resize, sidebar toggle, etc.)
    const ro = new ResizeObserver(syncSize)
    ro.observe(wrapper)

    // ── Shell ──────────────────────────────────────────────────────────────
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
      if (shellIdRef.current) window.api.terminal.write(connId, shellIdRef.current, data)
    })

    const unsubOutput = window.api.terminal.onOutput(({ shellId, data }) => {
      if (shellId === shellIdRef.current) terminal.write(data)
    })

    return () => {
      unsubOutput()
      ro.disconnect()
      if (shellIdRef.current) window.api.terminal.close(connId, shellIdRef.current)
      terminal.dispose()
    }
  }, [connId, terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink])

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <div ref={termRef} /* dimensions set by syncSize() */ />
      {!isReady && (
        <div style={styles.loading}>
          <span>Connecting to shell...</span>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  // The wrapper IS the bounding box. overflow:hidden clips anything that
  // extends beyond it. Its size comes from .tab-content via absolute pos.
  wrapper: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    background: '#1a1b2e',
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
