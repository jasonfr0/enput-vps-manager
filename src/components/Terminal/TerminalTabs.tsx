import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { TerminalView } from './TerminalView'

interface TerminalTab {
  /**
   * Local React-key + display id. The backend's PTY shellId is owned by the
   * mounted TerminalView and is opaque to this wrapper — TerminalView creates
   * its own shell on mount via window.api.terminal.create().
   */
  id: string
  label: string
}

interface TerminalTabsProps {
  connId: string
  /** When true, terminal output is shown but keyboard input is blocked */
  readOnly?: boolean
  /** When true, this whole panel is currently visible — gates keyboard shortcuts + active-tab refit */
  isActive?: boolean
}

let nextLocalId = 0
const makeId = () => `tab_${++nextLocalId}_${Date.now().toString(36)}`

/**
 * Tabbed wrapper around TerminalView.
 *
 * Each tab mounts its own TerminalView instance, which owns a single backend
 * PTY shellId. The IPC contract (terminal.create / write / resize / close /
 * onOutput) already supports many shells per connection, so this is a pure-UI
 * change with no backend touch.
 *
 * Tab state is local + keyed by connId — switching servers (or reconnecting,
 * which kills all PTYs server-side) resets to a single fresh tab. Keep all
 * tabs mounted so scrollback + shell state survive tab switches; visibility is
 * toggled with display:none to avoid React unmount + reconnect churn.
 */
export function TerminalTabs({ connId, readOnly = false, isActive = true }: TerminalTabsProps) {
  const initialTab = useRef<TerminalTab>({ id: makeId(), label: 'Shell 1' })
  const [tabs, setTabs]         = useState<TerminalTab[]>([initialTab.current])
  const [activeId, setActiveId] = useState<string>(initialTab.current.id)
  const counterRef              = useRef(1)

  // Reset tabs whenever the underlying connection changes — old PTYs are dead
  // either way (different server, or backend tore them down on disconnect).
  useEffect(() => {
    const fresh = { id: makeId(), label: 'Shell 1' }
    counterRef.current = 1
    setTabs([fresh])
    setActiveId(fresh.id)
  }, [connId])

  const addTab = useCallback(() => {
    counterRef.current += 1
    const t = { id: makeId(), label: `Shell ${counterRef.current}` }
    setTabs((prev) => [...prev, t])
    setActiveId(t.id)
  }, [])

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)

      // Never leave zero tabs — replace with a fresh one so the panel always
      // shows a usable terminal. (Closing the only tab is a more discoverable
      // affordance than disabling the close button.)
      if (next.length === 0) {
        const fresh = { id: makeId(), label: 'Shell 1' }
        counterRef.current = 1
        setActiveId(fresh.id)
        return [fresh]
      }

      // If we just closed the active tab, focus the neighbour to its left
      // (or the new first tab if we closed the leftmost).
      setActiveId((cur) => {
        if (cur !== id) return cur
        const idx = prev.findIndex((t) => t.id === id)
        const target = next[Math.max(0, idx - 1)]
        return target.id
      })

      return next
    })
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  // Only active when the terminal panel itself is visible. We intentionally
  // require Shift on T/W so we don't steal Ctrl-T / Ctrl-W from the shell
  // (transpose-chars in readline, common shortcuts in vim/less/irssi/etc.).
  // Cmd/Ctrl + 1..9 is unambiguous in xterm so we use it bare for tab switching.
  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault()
        addTab()
        return
      }
      if (e.shiftKey && (e.key === 'W' || e.key === 'w')) {
        e.preventDefault()
        closeTab(activeId)
        return
      }
      // Cmd/Ctrl + 1..9 — switch to that tab if it exists
      if (!e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1
        if (idx < tabs.length) {
          e.preventDefault()
          setActiveId(tabs[idx].id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, activeId, tabs, addTab, closeTab])

  return (
    <div style={styles.root}>
      <div style={styles.strip} role="tablist" aria-label="Terminal sessions">
        <div style={styles.tabs}>
          {tabs.map((t, idx) => {
            const isCurrent = t.id === activeId
            const canClose  = tabs.length > 1
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isCurrent}
                onClick={() => setActiveId(t.id)}
                onAuxClick={(e) => { if (e.button === 1 && canClose) { e.preventDefault(); closeTab(t.id) } }}
                style={{
                  ...styles.tab,
                  ...(isCurrent ? styles.tabActive : null),
                }}
                title={`${t.label}${idx < 9 ? `  •  ${ctrlOrCmdLabel()}+${idx + 1}` : ''}`}
              >
                <span style={styles.tabLabel}>{t.label}</span>
                <span
                  role="button"
                  aria-label={`Close ${t.label}`}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(t.id)
                  }}
                  style={{
                    ...styles.tabClose,
                    opacity: isCurrent || canClose ? 1 : 0.4,
                    visibility: tabs.length === 1 ? 'hidden' : 'visible',
                  }}
                >
                  <X size={11} />
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={addTab}
          style={styles.addBtn}
          title={`New shell  •  ${ctrlOrCmdLabel()}+Shift+T`}
          aria-label="New shell"
        >
          <Plus size={13} />
        </button>
      </div>

      <div style={styles.body}>
        {tabs.map((t) => {
          const isCurrent = t.id === activeId
          return (
            // Keep every TerminalView mounted; toggle visibility so xterm
            // keeps its scrollback + the PTY stays attached. display:none
            // is fine here because TerminalView's isActive prop triggers a
            // re-fit on the next frame when the tab becomes visible again.
            <div
              key={t.id}
              style={{
                ...styles.pane,
                display: isCurrent ? 'block' : 'none',
              }}
            >
              <TerminalView
                connId={connId}
                readOnly={readOnly}
                isActive={isActive && isCurrent}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Best-effort label for the modifier key in tooltips. Doesn't try to be
// perfect — just nicer than always saying "Ctrl" on macOS.
function ctrlOrCmdLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)) {
    return '⌘'
  }
  return 'Ctrl'
}

// ─── Styles ──────────────────────────────────────────────────────
// The terminal canvas stays dark even in light theme, so the tab strip uses
// dark surfaces tuned to sit just above the terminal background (#1a1b2e).
const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1b2e',
    overflow: 'hidden',
  },
  strip: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'stretch',
    background: '#13141f',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    height: '32px',
    paddingRight: '4px',
  },
  tabs: {
    flex: 1,
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    minWidth: 0,
  },
  tab: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 10px 0 12px',
    minWidth: '90px',
    maxWidth: '180px',
    height: '100%',
    background: 'transparent',
    border: 'none',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
    color: 'rgba(232, 233, 240, 0.55)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 120ms ease, color 120ms ease',
  },
  tabActive: {
    background: '#1a1b2e',
    color: '#e8e9f0',
    boxShadow: 'inset 0 -2px 0 0 var(--accent)',
  },
  tabLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'left',
  },
  tabClose: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    color: 'rgba(232, 233, 240, 0.55)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '100%',
    background: 'transparent',
    border: 'none',
    color: 'rgba(232, 233, 240, 0.55)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  },
  body: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  pane: {
    position: 'absolute',
    inset: 0,
  },
}
