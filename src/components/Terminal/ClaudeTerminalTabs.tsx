import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ClaudeTerminal } from './ClaudeTerminal'

interface ClaudeTab {
  /**
   * Local React-key + display id. Each ClaudeTerminal instance owns its own
   * PTY shellId, claudeStatus, workingDir, and directory picker — this wrapper
   * just manages the tab list and which one is visible.
   */
  id: string
  label: string
}

interface ClaudeTerminalTabsProps {
  connId: string
  /** When true, this whole panel is currently visible — gates keyboard shortcuts + active-tab refit */
  isActive?: boolean
}

let nextLocalId = 0
const makeId = () => `ctab_${++nextLocalId}_${Date.now().toString(36)}`

/**
 * Tabbed wrapper around ClaudeTerminal.
 *
 * Mirrors TerminalTabs in shape (keyboard shortcuts, rename UX, dark strip),
 * but spawns ClaudeTerminal per tab so each session has its own Claude CLI
 * status, working directory, and PTY. The IPC contract is identical to the
 * regular shell terminal — ClaudeTerminal calls window.api.terminal.create()
 * just like TerminalView, so no backend changes are needed.
 */
export function ClaudeTerminalTabs({ connId, isActive = true }: ClaudeTerminalTabsProps) {
  const initialTab = useRef<ClaudeTab>({ id: makeId(), label: 'Claude 1' })
  const [tabs, setTabs]         = useState<ClaudeTab[]>([initialTab.current])
  const [activeId, setActiveId] = useState<string>(initialTab.current.id)
  const counterRef              = useRef(1)

  // Inline rename state — same pattern as TerminalTabs.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')

  // Reset whenever the underlying connection changes.
  useEffect(() => {
    const fresh = { id: makeId(), label: 'Claude 1' }
    counterRef.current = 1
    setTabs([fresh])
    setActiveId(fresh.id)
    setEditingId(null)
  }, [connId])

  const addTab = useCallback(() => {
    counterRef.current += 1
    const t = { id: makeId(), label: `Claude ${counterRef.current}` }
    setTabs((prev) => [...prev, t])
    setActiveId(t.id)
  }, [])

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        const fresh = { id: makeId(), label: 'Claude 1' }
        counterRef.current = 1
        setActiveId(fresh.id)
        return [fresh]
      }
      setActiveId((cur) => {
        if (cur !== id) return cur
        const idx = prev.findIndex((t) => t.id === id)
        const target = next[Math.max(0, idx - 1)]
        return target.id
      })
      return next
    })
  }, [])

  const startRename = useCallback((id: string, currentLabel: string) => {
    setActiveId(id)
    setDraftLabel(currentLabel)
    setEditingId(id)
  }, [])

  const commitRename = useCallback(() => {
    setEditingId((id) => {
      if (id === null) return null
      const trimmed = draftLabel.trim()
      if (trimmed.length > 0) {
        const next = trimmed.slice(0, 40)
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, label: next } : t)))
      }
      return null
    })
  }, [draftLabel])

  const cancelRename = useCallback(() => {
    setEditingId(null)
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  // Only active when this panel is visible. Same convention as TerminalTabs:
  // Cmd/Ctrl+Shift+T add, Cmd/Ctrl+Shift+W close, Cmd/Ctrl+1..9 switch, F2 rename.
  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2' && editingId === null) {
        const tag = (document.activeElement?.tagName ?? '').toLowerCase()
        if (tag === 'input' || tag === 'textarea') return
        e.preventDefault()
        const t = tabs.find((x) => x.id === activeId)
        if (t) startRename(t.id, t.label)
        return
      }

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
  }, [isActive, activeId, tabs, addTab, closeTab, editingId, startRename])

  return (
    <div style={styles.root}>
      <div style={styles.strip} role="tablist" aria-label="Claude Code sessions">
        <div style={styles.tabs}>
          {tabs.map((t, idx) => {
            const isCurrent = t.id === activeId
            const isEditing = t.id === editingId
            const canClose  = tabs.length > 1
            return (
              <div
                key={t.id}
                role="tab"
                aria-selected={isCurrent}
                onClick={() => { if (!isEditing) setActiveId(t.id) }}
                onDoubleClick={() => { if (!isEditing) startRename(t.id, t.label) }}
                onAuxClick={(e) => { if (e.button === 1 && canClose) { e.preventDefault(); closeTab(t.id) } }}
                style={{
                  ...styles.tab,
                  ...(isCurrent ? styles.tabActive : null),
                }}
                title={isEditing
                  ? 'Press Enter to save, Escape to cancel'
                  : `${t.label}  •  Double-click or F2 to rename${idx < 9 ? `  •  ${ctrlOrCmdLabel()}+${idx + 1}` : ''}`}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')       { e.preventDefault(); commitRename() }
                      else if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                      else if (e.metaKey || e.ctrlKey) { e.stopPropagation() }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.currentTarget.select()}
                    maxLength={40}
                    spellCheck={false}
                    style={styles.tabInput}
                    aria-label="Rename Claude session"
                  />
                ) : (
                  <span style={styles.tabLabel}>{t.label}</span>
                )}
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
              </div>
            )
          })}
        </div>
        <button
          onClick={addTab}
          style={styles.addBtn}
          title={`New Claude session  •  ${ctrlOrCmdLabel()}+Shift+T`}
          aria-label="New Claude session"
        >
          <Plus size={13} />
        </button>
      </div>

      <div style={styles.body}>
        {tabs.map((t) => {
          const isCurrent = t.id === activeId
          return (
            <div
              key={t.id}
              style={{
                ...styles.pane,
                display: isCurrent ? 'block' : 'none',
              }}
            >
              <ClaudeTerminal
                connId={connId}
                isActive={isActive && isCurrent}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ctrlOrCmdLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)) {
    return '⌘'
  }
  return 'Ctrl'
}

// Same dark strip as TerminalTabs — the Claude canvas is also dark (#1a1a2e).
const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a2e',
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
    background: '#1a1a2e',
    color: '#e8e9f0',
    boxShadow: 'inset 0 -2px 0 0 var(--accent)',
  },
  tabLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'left',
  },
  tabInput: {
    flex: 1,
    minWidth: 0,
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid var(--accent)',
    borderRadius: '3px',
    color: '#e8e9f0',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'inherit',
    padding: '2px 6px',
    outline: 'none',
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
