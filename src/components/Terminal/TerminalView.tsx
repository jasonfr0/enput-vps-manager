import React, { useLayoutEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettingsStore } from '../../context/useSettingsStore'

interface TerminalViewProps {
  connId: string
  /** When true, terminal output is shown but keyboard input is blocked (read-only role) */
  readOnly?: boolean
}

export function TerminalView({ connId, readOnly = false }: TerminalViewProps) {
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const termRef     = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const shellIdRef  = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink } = useSettingsStore()

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
    // We measure available height as (viewport bottom − wrapper top) rather
    // than relying on the CSS-computed height of the container.  This is
    // the same viewport-anchored value the ResizeObserver sees after a
    // minimize→maximize, and it guarantees the terminal never extends below
    // the visible window regardless of any flex/absolute layout quirks.
    const syncSize = () => {
      const rect = wrapper.getBoundingClientRect()
      if (rect.width <= 0) return
      const h = Math.max(1, Math.floor(window.innerHeight - rect.top))
      termEl.style.height = `${h}px`   // explicit integer px so FitAddon reads
      fitAddon.fit()                    // the correct height from getComputedStyle
      scrollToBottom()
      // One extra frame covers xterm's post-resize canvas repaint.
      requestAnimationFrame(scrollToBottom)
      if (shellIdRef.current) {
        window.api.terminal.resize(connId, shellIdRef.current, terminal.cols, terminal.rows)
      }
    }

    // Defer the initial fit to the next animation frame so the browser has
    // fully resolved flex layout (the same timing path ResizeObserver uses,
    // which is why minimize→maximize always fixes sizing).
    requestAnimationFrame(syncSize)

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

    if (!readOnly) {
      terminal.onData((data) => {
        if (shellIdRef.current) window.api.terminal.write(connId, shellIdRef.current, data)
      })
    } else {
      // Show a read-only banner
      terminal.writeln('\x1b[33m[Read-only mode — input disabled]\x1b[0m\r\n')
    }

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
  }, [connId, readOnly, terminalFontSize, terminalScrollback, terminalCursorStyle, terminalCursorBlink])

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
  // position: absolute with top/left/right set, but NO bottom — height is
  // set imperatively in syncSize so the JS value isn't overridden by CSS.
  term: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
