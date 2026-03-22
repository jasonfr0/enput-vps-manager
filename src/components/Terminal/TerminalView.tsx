import React, { useLayoutEffect, useRef, useState } from 'react'
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

  // useLayoutEffect fires synchronously after the DOM is mutated but BEFORE
  // the browser paints. At this point the CSS layout is fully resolved, so
  // termEl.offsetHeight is the true rendered height — no animation-frame
  // delays needed, and FitAddon gets the correct rows/cols immediately.
  useLayoutEffect(() => {
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
      scrollback: 0,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(termEl)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // ── Scroll helper ─────────────────────────────────────────────────────
    // Setting .xterm-viewport scrollTop directly is more reliable than
    // terminal.scrollToBottom(). It triggers xterm's native scroll event
    // listener which updates the internal ydisp state, so xterm keeps
    // auto-scrolling on subsequent writes without us fighting its render
    // cycle. We also call the API as a belt-and-suspenders measure.
    const scrollToBottom = () => {
      const vp = termEl.querySelector('.xterm-viewport') as HTMLElement | null
      if (vp) vp.scrollTop = vp.scrollHeight
      terminal.scrollToBottom()
    }

    // ── Size sync ─────────────────────────────────────────────────────────
    // Dimensions are resolved because we're in useLayoutEffect, so we call
    // fit() immediately — no animation-frame dancing required.
    const syncSize = () => {
      fitAddon.fit()
      scrollToBottom()
      // One extra frame covers xterm's post-resize canvas repaint.
      requestAnimationFrame(scrollToBottom)
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    }

    syncSize()

    // Re-fit whenever the wrapper changes size (window resize, sidebar, etc.)
    const ro = new ResizeObserver(syncSize)
    ro.observe(wrapper)

    // ── Shell ─────────────────────────────────────────────────────────────
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
        // Write callback fires after xterm has parsed + buffered the data,
        // so scrollToBottom lands at the actual new bottom. The extra rAF
        // covers xterm's canvas redraw which happens in the next frame.
        terminal.write(data, () => requestAnimationFrame(scrollToBottom))
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
  wrapper: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    background: '#1a1b2e',
  },
  // Absolutely positioned so it fills wrapper exactly and never
  // participates in normal document flow.
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
