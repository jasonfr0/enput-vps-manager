import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useConfirmStore } from '../../context/useConfirmStore'

/**
 * App-wide confirmation dialog host.
 *
 * Mounts once near the root of the tree (next to <ToastContainer />).
 * Driven entirely by `useConfirmStore` — callers invoke `confirmDialog({...})`
 * and `await` the result instead of using native `confirm()`.
 */
export function ConfirmDialog() {
  const active = useConfirmStore((s) => s.active)
  const resolve = useConfirmStore((s) => s.resolve)

  const [typed, setTyped] = useState('')
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)
  const typedInputRef = useRef<HTMLInputElement | null>(null)

  // Reset typed-word input whenever a new dialog opens.
  useEffect(() => {
    setTyped('')
  }, [active?.id])

  // Autofocus: typed input if present, otherwise the confirm button.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => {
      if (active.typedWord && typedInputRef.current) {
        typedInputRef.current.focus()
      } else if (confirmBtnRef.current) {
        confirmBtnRef.current.focus()
      }
    }, 30)
    return () => clearTimeout(t)
  }, [active?.id, active?.typedWord])

  // Keyboard shortcuts: Esc = cancel, Enter = confirm (when enabled).
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        resolve(false)
      } else if (e.key === 'Enter') {
        // Enter only confirms when not blocked by a typed-word requirement.
        if (!active.typedWord || typed.trim() === active.typedWord) {
          e.preventDefault()
          resolve(true)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, typed, resolve])

  if (!active) return null

  const variant = active.variant ?? 'primary'
  const typedOk = !active.typedWord || typed.trim() === active.typedWord
  const confirmDisabled = !typedOk

  return (
    <div
      style={s.overlay}
      onClick={() => resolve(false)}
      role="presentation"
    >
      <div
        style={s.dialog}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div style={s.header}>
          <div style={s.headerLeft}>
            {variant === 'danger' && (
              <span style={{ ...s.headerIcon, color: '#f44336' }}>
                <AlertTriangle size={18} />
              </span>
            )}
            <span id="confirm-dialog-title" style={s.title}>
              {active.title}
            </span>
          </div>
          <button
            style={s.closeBtn}
            onClick={() => resolve(false)}
            title="Cancel"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>

        <div style={s.body}>
          {active.message && <p style={s.message}>{active.message}</p>}

          {active.typedWord && (
            <div style={s.typedField}>
              <label style={s.typedLabel}>
                Type <code style={s.typedCode}>{active.typedWord}</code> to confirm.
              </label>
              <input
                ref={typedInputRef}
                style={s.typedInput}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={() => resolve(false)}>
            {active.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            style={{
              ...s.confirmBtn,
              ...(variant === 'danger' ? s.confirmBtnDanger : s.confirmBtnPrimary),
              opacity: confirmDisabled ? 0.5 : 1,
              cursor: confirmDisabled ? 'not-allowed' : 'pointer',
            }}
            onClick={() => { if (!confirmDisabled) resolve(true) }}
            disabled={confirmDisabled}
          >
            {active.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: '420px',
    maxWidth: '92vw',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    gap: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  message: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
  },
  typedField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  typedLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  typedCode: {
    fontFamily: 'var(--font-mono)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '1px 6px',
    fontSize: 12,
    color: 'var(--text-primary)',
  },
  typedInput: {
    padding: '8px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-primary)',
  },
  cancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
  },
  confirmBtnPrimary: {
    background: 'var(--accent)',
  },
  confirmBtnDanger: {
    background: '#f44336',
  },
}
