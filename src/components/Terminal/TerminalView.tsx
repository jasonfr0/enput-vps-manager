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
    // termEl is position:absolute; inset:0 inside wrapper, so it always
    // fills wrapper exactly. FitAddon reads termEl's offsetWidth/Height
    // (== wrapper's rendered size) to calculate cols/rows. scrollToBottom()
    // is called after every fit so the cursor stays in view.
    const syncSize = () => {
      fitAddon.fit()
      terminal.scrollToBottom()
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
      if (shellId === shellIdRef.current) {
        terminal.write(data)
        terminal.scrollToBottom()
      }
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
  // The wrapper IS the bounding box. overflow:hidden clips anything that
  // extends beyond it. Its size comes from .tab-content via absolute pos.
  wrapper: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    background: '#1a1b2e',
  },
  // termEl fills wrapper exactly via absolute+inset:0. Being absolutely
  // positioned it never participates in normal flow, so xterm's canvas and
  // viewport cannot push the layout. overflow:hidden clips any sub-pixel
  // overhang from the canvas sizing calculations.
  term: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
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
