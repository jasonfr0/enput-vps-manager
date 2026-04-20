import React, { useState } from 'react'
import { AlertTriangle, ArrowUpCircle, Check, Download, X } from 'lucide-react'
import { useUpdateStore } from '../../context/useUpdateStore'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
}

export function UpdateBanner() {
  const { status, version, progress, error, check, download, install } = useUpdateStore()
  const [dismissed, setDismissed] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const releaseNotes = useUpdateStore((s) => s.releaseNotes)

  // Nothing to show
  if (dismissed) return null
  if (status === 'idle' || status === 'checking' || status === 'not-available') return null

  if (status === 'error') {
    return (
      <div style={{ ...s.banner, background: 'rgba(244,67,54,0.12)', borderColor: 'rgba(244,67,54,0.35)' }}>
        <span style={{ ...s.icon, color: '#f44336' }}><AlertTriangle size={14} /></span>
        <span style={s.text}>Update check failed: {error}</span>
        <button style={s.actionBtn} onClick={() => check()}>Retry</button>
        <button style={s.dismissBtn} onClick={() => setDismissed(true)} title="Dismiss">
          <X size={14} />
        </button>
      </div>
    )
  }

  if (status === 'available') {
    return (
      <div style={{ ...s.banner, background: 'rgba(108,99,255,0.1)', borderColor: 'rgba(108,99,255,0.35)' }}>
        <span style={s.icon}><ArrowUpCircle size={14} /></span>
        <span style={s.text}>
          Version <strong style={{ color: 'var(--text-primary)' }}>{version}</strong> is available.
          {releaseNotes && (
            <button style={s.linkBtn} onClick={() => setShowNotes(v => !v)}>
              {showNotes ? 'Hide notes' : 'What\'s new?'}
            </button>
          )}
        </span>
        <button style={{ ...s.actionBtn, background: 'var(--accent)' }} onClick={() => download()}>
          Download
        </button>
        <button style={s.dismissBtn} onClick={() => setDismissed(true)} title="Dismiss">
          <X size={14} />
        </button>
        {showNotes && releaseNotes && (
          <div style={s.notesPopout}>
            <pre style={s.notesPre}>{releaseNotes}</pre>
          </div>
        )}
      </div>
    )
  }

  if (status === 'downloading' && progress) {
    return (
      <div style={{ ...s.banner, background: 'rgba(63,142,245,0.1)', borderColor: 'rgba(63,142,245,0.3)' }}>
        <span style={s.icon}><Download size={14} /></span>
        <div style={s.progressWrap}>
          <div style={s.progressRow}>
            <span style={s.text}>
              Downloading v{version}… {progress.percent}%
            </span>
            <span style={s.metaText}>
              {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              &nbsp;·&nbsp;{formatSpeed(progress.bytesPerSecond)}
            </span>
          </div>
          <div style={s.progressTrack}>
            <div
              style={{
                ...s.progressFill,
                width: `${progress.percent}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (status === 'ready') {
    return (
      <div style={{ ...s.banner, background: 'rgba(76,175,80,0.1)', borderColor: 'rgba(76,175,80,0.35)' }}>
        <span style={{ ...s.icon, color: 'var(--success)' }}><Check size={14} /></span>
        <span style={s.text}>
          Version <strong style={{ color: 'var(--text-primary)' }}>{version}</strong> is ready to install.
        </span>
        <button
          style={{ ...s.actionBtn, background: 'var(--success)' }}
          onClick={() => install()}
        >
          Restart &amp; Install
        </button>
        <button style={s.dismissBtn} onClick={() => setDismissed(true)} title="Dismiss">
          <X size={14} />
        </button>
      </div>
    )
  }

  return null
}

const s: Record<string, React.CSSProperties> = {
  banner: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 14px',
    borderBottom: '1px solid transparent',
    fontSize: '12px',
    flexShrink: 0,
    zIndex: 50,
    flexWrap: 'wrap' as const,
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  metaText: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    flexShrink: 0,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '0 4px',
    textDecoration: 'underline',
  },
  actionBtn: {
    padding: '3px 12px',
    background: 'var(--bg-tertiary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
    fontWeight: 500,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px 4px',
    flexShrink: 0,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    minWidth: 0,
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  progressTrack: {
    height: '3px',
    borderRadius: '2px',
    background: 'var(--bg-tertiary)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: '2px',
  },
  notesPopout: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 200,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderTop: 'none',
    maxHeight: '180px',
    overflow: 'auto',
    padding: '12px 16px',
  },
  notesPre: {
    margin: 0,
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
}
