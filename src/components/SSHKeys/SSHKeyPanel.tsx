import React, { useEffect, useState, useCallback } from 'react'
import { KeyRound, Plug, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useConnectionStore } from '../../context/useConnectionStore'
import { notify } from '../../context/useNotificationStore'
import { confirmDialog } from '../../context/useConfirmStore'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

interface SSHKeyInfo {
  name: string; privatePath: string; publicPath: string
  type: string; comment: string; fingerprint: string
}
interface AuthorizedKey {
  type: string; key: string; comment: string; raw: string
}

// ─── Local Keys ──────────────────────────────────────────────────
function LocalKeyRow({
  k, onDelete, onCopy, onAuthorize, connected,
}: {
  k: SSHKeyInfo
  onDelete: () => void
  onCopy: () => void
  onAuthorize: (pub: string) => void
  connected: boolean
}) {
  const typeLabel = k.type.replace('ssh-', '').toUpperCase()
  const typeColor = k.type.includes('ed25519') ? '#69f0ae' : k.type.includes('rsa') ? '#74b9ff' : '#ffd740'

  return (
    <div style={s.keyCard}>
      <div style={s.keyCardTop}>
        <span style={{ ...s.typeBadge, background: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44` }}>
          {typeLabel}
        </span>
        <span style={s.keyName}>~/.ssh/{k.name}</span>
      </div>
      <div style={s.keyMeta}>
        <span style={s.fingerprint}>{k.fingerprint}</span>
        {k.comment && <span style={s.comment}>{k.comment}</span>}
      </div>
      <div style={s.keyActions}>
        <button style={s.actionBtn} onClick={onCopy} title="Copy public key to clipboard">
          Copy Public Key
        </button>
        {connected && (
          <button
            style={{ ...s.actionBtn, color: 'var(--accent)', borderColor: 'var(--accent)' }}
            onClick={() =>
              window.api.sshKeys.getPublic(k.name).then((pub: string) => onAuthorize(pub))
            }
            title="Add this key to the server's authorized_keys"
          >
            Authorize on Server
          </button>
        )}
        <button
          style={{ ...s.actionBtn, color: 'var(--error)', borderColor: 'var(--border)', marginLeft: 'auto' }}
          onClick={onDelete}
          title="Delete key pair from disk"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ─── Generate form ────────────────────────────────────────────────
function GenerateKeyForm({ onGenerated }: { onGenerated: (k: SSHKeyInfo) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'ed25519' | 'rsa'>('ed25519')
  const [comment, setComment] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Key name is required'); return }
    if (!/^[\w.-]+$/.test(trimmed)) { setError('Name can only contain letters, numbers, _ . -'); return }
    setBusy(true)
    setError('')
    try {
      const key = await (window.api as any).sshKeys.generate(trimmed, type, passphrase, comment.trim())
      onGenerated(key)
      notify.success('Key generated', `~/.ssh/${trimmed}`)
      setOpen(false)
      setName(''); setComment(''); setPassphrase('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button style={s.addBtn} onClick={() => setOpen(true)}>
        + Generate New Key
      </button>
    )
  }

  return (
    <div style={s.generateForm}>
      <div style={s.formRow}>
        <label style={s.formLabel}>Name</label>
        <input
          style={s.formInput}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="id_ed25519_myserver"
          autoFocus
        />
      </div>
      <div style={s.formRow}>
        <label style={s.formLabel}>Type</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['ed25519', 'rsa'] as const).map(t => (
            <button
              key={t}
              style={{ ...s.typeToggle, ...(type === t ? s.typeToggleActive : {}) }}
              onClick={() => setType(t)}
            >
              {t === 'ed25519' ? 'Ed25519 (recommended)' : 'RSA 4096'}
            </button>
          ))}
        </div>
      </div>
      <div style={s.formRow}>
        <label style={s.formLabel}>Comment</label>
        <input
          style={s.formInput}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="you@hostname (optional)"
        />
      </div>
      <div style={s.formRow}>
        <label style={s.formLabel}>Passphrase</label>
        <input
          type="password"
          style={s.formInput}
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          placeholder="Leave blank for no passphrase"
        />
      </div>
      {error && <div style={s.formError}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button style={s.primaryBtn} onClick={handleGenerate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate'}
        </button>
        <button style={s.ghostBtn} onClick={() => { setOpen(false); setError('') }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Authorized key row ───────────────────────────────────────────
function AuthorizedKeyRow({ k, onRemove }: { k: AuthorizedKey; onRemove: () => void }) {
  const typeLabel = k.type.replace('ssh-', '').toUpperCase()
  const preview = k.key.length > 24 ? k.key.slice(0, 12) + '…' + k.key.slice(-8) : k.key
  return (
    <div style={s.authRow}>
      <span style={s.authType}>{typeLabel}</span>
      <span style={s.authKey}>{preview}</span>
      <span style={s.authComment}>{k.comment || '—'}</span>
      <button style={{ ...s.actionBtn, color: 'var(--error)' }} onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────
export function SSHKeyPanel() {
  const { activeConnId, connectionStatus } = useConnectionStore()
  const connected = !!activeConnId && connectionStatus === 'connected'

  const [localKeys, setLocalKeys] = useState<SSHKeyInfo[]>([])
  const [authorizedKeys, setAuthorizedKeys] = useState<AuthorizedKey[]>([])
  const [loadingLocal, setLoadingLocal] = useState(true)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [error, setError] = useState('')

  const loadLocal = useCallback(async () => {
    setLoadingLocal(true)
    try {
      const keys = await (window.api as any).sshKeys.listLocal()
      setLocalKeys(keys)
    } catch (err: any) {
      setError('Failed to load local keys: ' + err.message)
    } finally {
      setLoadingLocal(false)
    }
  }, [])

  const loadRemote = useCallback(async () => {
    if (!activeConnId) return
    setLoadingRemote(true)
    try {
      const keys = await (window.api as any).sshKeys.listAuthorized(activeConnId)
      setAuthorizedKeys(keys)
    } catch (err: any) {
      setError('Failed to load authorized keys: ' + err.message)
    } finally {
      setLoadingRemote(false)
    }
  }, [activeConnId])

  useEffect(() => { loadLocal() }, [])
  useEffect(() => { if (connected) loadRemote() }, [connected, activeConnId])

  const handleCopy = async (name: string) => {
    try {
      const pub = await (window.api as any).sshKeys.getPublic(name)
      await navigator.clipboard.writeText(pub)
      notify.success('Copied', 'Public key copied to clipboard')
    } catch (err: any) {
      notify.error('Copy failed', err.message)
    }
  }

  const handleDelete = async (name: string) => {
    const ok = await confirmDialog({
      title: `Delete key pair "~/.ssh/${name}"?`,
      message: 'Both the private and public key files will be removed from this computer. This cannot be undone.',
      confirmLabel: 'Delete key pair',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await (window.api as any).sshKeys.delete(name)
      setLocalKeys(prev => prev.filter(k => k.name !== name))
      notify.success('Key deleted', `~/.ssh/${name}`)
    } catch (err: any) {
      notify.error('Delete failed', err.message)
    }
  }

  const handleAuthorize = async (publicKeyLine: string) => {
    if (!activeConnId) return
    try {
      await (window.api as any).sshKeys.addAuthorized(activeConnId, publicKeyLine)
      notify.success('Key authorized', 'Added to ~/.ssh/authorized_keys on server')
      loadRemote()
    } catch (err: any) {
      notify.error('Authorize failed', err.message)
    }
  }

  const handleRemoveAuthorized = async (rawLine: string) => {
    if (!activeConnId) return
    const ok = await confirmDialog({
      title: 'Remove this key from authorized_keys?',
      message: 'The key will no longer grant access to this server. You can re-authorize it later.',
      confirmLabel: 'Remove key',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await (window.api as any).sshKeys.removeAuthorized(activeConnId, rawLine)
      setAuthorizedKeys(prev => prev.filter(k => k.raw !== rawLine))
      notify.success('Key removed', 'Removed from ~/.ssh/authorized_keys')
    } catch (err: any) {
      notify.error('Remove failed', err.message)
    }
  }

  return (
    <div style={s.panel}>
      {error && (
        <div style={s.errorBanner}>
          {error}
          <button style={s.errorDismiss} onClick={() => setError('')} title="Dismiss">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Local keys ───────────────────────────────── */}
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>LOCAL KEYS</span>
        <span style={s.sectionHint}>~/.ssh/ on this machine</span>
        <button style={s.refreshBtn} onClick={loadLocal} title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      {loadingLocal ? (
        <SSHKeyRowsSkeleton />
      ) : localKeys.length === 0 ? (
        <EmptyState
          size="sm"
          icon={KeyRound}
          title="No SSH keys yet"
          description="Generate a key pair below to get started."
        />
      ) : (
        localKeys.map(k => (
          <LocalKeyRow
            key={k.name}
            k={k}
            connected={connected}
            onCopy={() => handleCopy(k.name)}
            onDelete={() => handleDelete(k.name)}
            onAuthorize={handleAuthorize}
          />
        ))
      )}

      <GenerateKeyForm onGenerated={key => setLocalKeys(prev => [...prev, key])} />

      {/* ── Authorized keys ───────────────────────────── */}
      <div style={{ ...s.sectionHeader, marginTop: 24 }}>
        <span style={s.sectionTitle}>AUTHORIZED KEYS ON SERVER</span>
        <span style={s.sectionHint}>~/.ssh/authorized_keys</span>
        {connected && (
          <button style={s.refreshBtn} onClick={loadRemote} title="Refresh">
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {!connected ? (
        <EmptyState
          size="sm"
          icon={Plug}
          title="Not connected"
          description="Connect to a server to manage its authorized keys."
        />
      ) : loadingRemote ? (
        <SSHKeyRowsSkeleton />
      ) : authorizedKeys.length === 0 ? (
        <EmptyState
          size="sm"
          icon={ShieldCheck}
          title="No authorized keys on this server"
          description="Authorize a local public key to grant SSH access."
        />
      ) : (
        <div style={s.authTable}>
          <div style={s.authHeader}>
            <span style={{ flex: '0 0 70px' }}>Type</span>
            <span style={{ flex: 1 }}>Key</span>
            <span style={{ flex: 1 }}>Comment</span>
            <span style={{ flex: '0 0 70px' }} />
          </div>
          {authorizedKeys.map((k, i) => (
            <AuthorizedKeyRow
              key={i}
              k={k}
              onRemove={() => handleRemoveAuthorized(k.raw)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  errorBanner: {
    padding: '8px 12px',
    background: 'rgba(244,67,54,0.1)',
    border: '1px solid rgba(244,67,54,0.3)',
    borderRadius: 6,
    color: 'var(--error)',
    fontSize: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorDismiss: {
    background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
  },
  sectionHint: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    opacity: 0.7,
  },
  refreshBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px 4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    padding: '14px 16px',
    background: 'var(--bg-tertiary)',
    borderRadius: 6,
    border: '1px solid var(--border)',
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
  },
  keyCard: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  keyCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 4,
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  keyName: {
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  keyMeta: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  fingerprint: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  comment: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  keyActions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
    marginTop: 2,
  },
  actionBtn: {
    padding: '3px 10px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  addBtn: {
    padding: '8px 14px',
    background: 'transparent',
    border: '1px dashed var(--border)',
    borderRadius: 6,
    color: 'var(--accent)',
    fontSize: 12,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center' as const,
    marginTop: 4,
  },
  generateForm: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--accent)',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  formRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  formLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
    width: 80,
    flexShrink: 0,
  },
  formInput: {
    flex: 1,
    padding: '5px 9px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  typeToggle: {
    padding: '4px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-muted)',
    fontSize: 11,
    cursor: 'pointer',
  },
  typeToggleActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#fff',
  },
  formError: {
    fontSize: 11,
    color: 'var(--error)',
    padding: '4px 0',
  },
  primaryBtn: {
    padding: '5px 16px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  ghostBtn: {
    padding: '5px 14px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-muted)',
    fontSize: 12,
    cursor: 'pointer',
  },
  authTable: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  authHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border)',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  authRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
  },
  authType: {
    flex: '0 0 70px',
    fontSize: 10,
    fontWeight: 700,
    color: '#74b9ff',
    fontFamily: 'var(--font-mono)',
  },
  authKey: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  authComment: {
    flex: 1,
    fontSize: 11,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
}

// Skeleton rows for both local-keys and authorized-keys lists — shape matches
// type badge, key body, comment. Shown while the first fetch is in flight.
function SSHKeyRowsSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-[56px] rounded" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-[90px]" />
        </div>
      ))}
    </div>
  )
}
