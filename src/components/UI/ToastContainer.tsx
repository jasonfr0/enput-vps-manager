import React, { useEffect, useRef, useState } from 'react'
import { useNotificationStore, Toast, NotificationType } from '../../context/useNotificationStore'

// ─── Individual toast ─────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Slide in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))

    // Auto-dismiss after duration (0 = sticky)
    if (toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(() => dismiss(), toast.duration)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const dismiss = () => {
    setLeaving(true)
    setTimeout(() => onDismiss(toast.id), 280)
  }

  const { bg, border, icon } = THEME[toast.type]

  return (
    <div
      style={{
        ...s.toast,
        background: bg,
        borderLeft: `3px solid ${border}`,
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(calc(100% + 16px))',
        transition: leaving
          ? 'opacity 270ms ease, transform 270ms ease'
          : 'opacity 220ms ease, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onClick={dismiss}
    >
      <span style={{ ...s.icon, color: border }}>{icon}</span>
      <div style={s.body}>
        <span style={s.title}>{toast.title}</span>
        {toast.message && <span style={s.message}>{toast.message}</span>}
      </div>
      <button style={s.close} onClick={(e) => { e.stopPropagation(); dismiss() }}>✕</button>
      {toast.duration && toast.duration > 0 && (
        <div
          style={{
            ...s.progressBar,
            background: border,
            animation: `toastProgress ${toast.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  )
}

const THEME: Record<NotificationType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(76, 175, 80, 0.12)',  border: '#4caf50', icon: '✓' },
  error:   { bg: 'rgba(244, 67, 54, 0.12)',  border: '#f44336', icon: '✕' },
  warning: { bg: 'rgba(255, 152, 0, 0.12)',  border: '#ff9800', icon: '⚠' },
  info:    { bg: 'rgba(100, 108, 255, 0.12)', border: '#646cff', icon: 'ℹ' },
}

// ─── Container ────────────────────────────────────────────────────
export function ToastContainer() {
  const { toasts, dismiss } = useNotificationStore()

  return (
    <>
      {/* Keyframe for the progress shrink animation */}
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      <div style={s.container}>
        {toasts.slice(-5).map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
    pointerEvents: 'none',
  },
  toast: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    width: 300,
    minWidth: 260,
    cursor: 'pointer',
    pointerEvents: 'auto',
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
  },
  icon: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: '18px',
    flexShrink: 0,
    marginTop: 1,
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  },
  message: {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
  },
  close: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
    padding: '1px 2px',
    flexShrink: 0,
    marginTop: 1,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    borderRadius: '0 0 0 8px',
    opacity: 0.6,
  },
}
