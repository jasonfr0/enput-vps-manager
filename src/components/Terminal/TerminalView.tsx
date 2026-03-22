import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettingsStore } from '../../context/useSettingsStore'

interface TerminalViewProps {
  connId: string
}

export function TerminalView({ connId }: TerminalViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink } = useSettingsStore()

  useEffect(() => {
    if (!termRef.current || !wrapperRef.current) return

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

    // Double rAF: wait for browser layout pass so the container has real
    // pixel dimensions before fitting.
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

    // Wheel handler on the wrapper — guarantees scrolling works even when a
    // running program has enabled mouse-tracking (which causes xterm to
    // forward wheel events to the pty instead of scrolling the viewport).
    const wrapper = wrapperRef.current
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const lines = Math.round(e.deltaY / 25) || (e.deltaY > 0 ? 1 : -1)
      terminal.scrollLines(lines)
    }
    wrapper.addEventListener('wheel', handleWheel, { passive: false })

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

    // Handle resize — observe the WRAPPER (the bounded flex element),
    // not the terminal div (which is absolutely positioned inside it).
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
    resizeObserver.observe(wrapper)

    // Listen for shell output
    const unsubOutput = window.api.terminal.onOutput(({ shellId, data }) => {
      if (shellId === shellIdRef.current) {
        terminal.write(data)
      }
    })

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

  return (
    <div style={styles.wrapper} ref={wrapperRef}>
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
  // Single wrapper: bounded by flex parent, clips overflow, hosts the
  // absolutely-positioned terminal div + loading overlay.
  wrapper: {
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    background: '#1a1b2e',
  },
  // The terminal div fills the wrapper exactly via absolute positioning.
  // NO overflow:hidden here — xterm's .xterm-viewport needs its own
  // overflow-y:scroll to remain interactive for scrolling.
  terminal: {
    position: 'absolute',
    inset: 0,
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
