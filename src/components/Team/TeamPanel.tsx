import React, { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, KeyRound, Loader2, Lock, Pencil, Plus, Server, Trash2, Users } from 'lucide-react'
import { TeamUser, UserRole } from '../../types/api'
import { useSessionStore, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../context/useSessionStore'
import { useConnectionStore } from '../../context/useConnectionStore'
import { confirmDialog } from '../../context/useConfirmStore'
import { notify } from '../../context/useNotificationStore'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

type View = 'list' | 'add' | 'edit' | 'password'

const ROLES: UserRole[] = ['admin', 'operator', 'readonly']

// Role badges: brand green for admin (privileged), neutral for operator,
// warning amber for read-only. Uses Enput semantic tokens so a future
// palette tweak only touches :root.
function Badge({ role }: { role: UserRole }) {
  const palette: Record<UserRole, { fg: string; bg: string; border: string }> = {
    admin: {
      fg: 'var(--accent)',
      bg: 'var(--accent-dim)',
      border: 'var(--accent-glow)',
    },
    operator: {
      fg: 'var(--text-secondary)',
      bg: 'var(--bg-tertiary)',
      border: 'var(--border)',
    },
    readonly: {
      fg: 'var(--warning)',
      bg: 'rgba(255, 143, 31, 0.10)',
      border: 'rgba(255, 143, 31, 0.30)',
    },
  }
  const c = palette[role]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      background: c.bg,
      color: c.fg,
      border: `1px solid ${c.border}`,
    }}>
      {ROLE_LABELS[role]}
    </span>
  )
}

export function TeamPanel() {
  const currentUser  = useSessionStore((s) => s.currentUser)
  const isAdmin      = useSessionStore((s) => s.isAdmin)()
  const isRemote     = useSessionStore((s) => s.isRemote)
  const servers      = useConnectionStore((s) => s.servers)

  // Pick the right API based on whether this session is authenticated locally
  // or against the remote auth server. The shapes are intentionally identical.
  const usersApi = isRemote
    ? {
        list:           () => window.api.authServer.listUsers(),
        create:         (u: string, p: string, r: UserRole, a: string[] | '*') =>
                          window.api.authServer.createUser(u, p, r, a),
        update:         (id: string, changes: { role?: UserRole; serverAccess?: string[] | '*' }) =>
                          window.api.authServer.updateUser(id, changes),
        delete:         (id: string) => window.api.authServer.deleteUser(id),
        changePassword: (id: string, pw: string) => window.api.authServer.changePassword(id, pw),
      }
    : {
        list:           () => window.api.users.list(),
        create:         (u: string, p: string, r: UserRole, a: string[] | '*') =>
                          window.api.users.create(u, p, r, a),
        update:         (id: string, changes: { role?: UserRole; serverAccess?: string[] | '*' }) =>
                          window.api.users.update(id, changes),
        delete:         (id: string) => window.api.users.delete(id),
        changePassword: (id: string, pw: string) => window.api.users.changePassword(id, pw),
      }

  const [users, setUsers]     = useState<TeamUser[]>([])
  const [view, setView]       = useState<View>('list')
  const [editTarget, setEditTarget] = useState<TeamUser | null>(null)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Add user form
  const [newUsername, setNewUsername]   = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [newConfirm, setNewConfirm]     = useState('')
  const [newRole, setNewRole]           = useState<UserRole>('operator')
  const [newAccess, setNewAccess]       = useState<'*' | string[]>('*')

  // Edit form
  const [editRole, setEditRole]         = useState<UserRole>('operator')
  const [editAccess, setEditAccess]     = useState<'*' | string[]>('*')

  // Change password form
  const [pwNew, setPwNew]               = useState('')
  const [pwConfirm, setPwConfirm]       = useState('')

  const loadUsers = async () => {
    setLoadError(null)
    try {
      const list = await usersApi.list()
      setUsers(list)
    } catch (e: any) {
      console.error('[TeamPanel] loadUsers:', e)
      setLoadError(e?.message ?? 'Failed to load team members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [isRemote])

  const resetForms = () => {
    setNewUsername(''); setNewPassword(''); setNewConfirm('')
    setNewRole('operator'); setNewAccess('*')
    setPwNew(''); setPwConfirm('')
    setError('')
  }

  const openAdd = () => { resetForms(); setView('add') }
  const openEdit = (u: TeamUser) => {
    setEditTarget(u)
    setEditRole(u.role)
    setEditAccess(u.serverAccess)
    setError('')
    setView('edit')
  }
  const openPassword = (u: TeamUser) => {
    setEditTarget(u)
    setPwNew(''); setPwConfirm('')
    setError('')
    setView('password')
  }
  const back = () => { setView('list'); setEditTarget(null); resetForms() }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!newUsername.trim()) { setError('Username is required'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPassword !== newConfirm) { setError('Passwords do not match'); return }
    setBusy(true)
    try {
      await usersApi.create(newUsername.trim(), newPassword, newRole, newAccess)
      await loadUsers()
      back()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create user')
    } finally {
      setBusy(false)
    }
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setBusy(true)
    setError('')
    try {
      await usersApi.update(editTarget.id, { role: editRole, serverAccess: editAccess })
      await loadUsers()
      back()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update user')
    } finally {
      setBusy(false)
    }
  }

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    if (pwNew.length < 8) { setError('Password must be at least 8 characters'); return }
    if (pwNew !== pwConfirm) { setError('Passwords do not match'); return }
    setBusy(true)
    setError('')
    try {
      await usersApi.changePassword(editTarget.id, pwNew)
      back()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to change password')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (u: TeamUser) => {
    const ok = await confirmDialog({
      title: `Delete user "${u.username}"?`,
      message: `This cannot be undone. ${u.username} will lose access immediately.`,
      confirmLabel: 'Delete user',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await usersApi.delete(u.id)
      await loadUsers()
      notify.success('User deleted', u.username)
    } catch (err: any) {
      notify.error('Failed to delete user', err?.message ?? String(err))
    }
  }

  // ── Server access toggle helper ─────────────────────────────────────────────

  function ServerAccessPicker({
    value, onChange
  }: { value: '*' | string[]; onChange: (v: '*' | string[]) => void }) {
    if (servers.length === 0) {
      return (
        <EmptyState
          size="sm"
          icon={Server}
          title="No servers configured yet"
          description="Add a server before assigning access."
        />
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={value === '*'}
            onChange={e => onChange(e.target.checked ? '*' : [])}
          />
          <span style={{ fontSize: '13px' }}>All servers (including future ones)</span>
        </label>
        {value !== '*' && servers.map(s => (
          <label key={s.id} style={styles.checkRow}>
            <input
              type="checkbox"
              checked={(value as string[]).includes(s.id)}
              onChange={e => {
                const arr = value as string[]
                onChange(e.target.checked
                  ? [...arr, s.id]
                  : arr.filter(id => id !== s.id))
              }}
            />
            <span style={{ fontSize: '13px' }}>{s.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({s.host})</span></span>
          </label>
        ))}
      </div>
    )
  }

  // ── Views ───────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div style={styles.root}>
        <div style={{ ...styles.center, color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
            <Lock size={32} strokeWidth={1.5} />
          </div>
          <p>Admin access required to manage team members.</p>
        </div>
      </div>
    )
  }

  if (view === 'add') {
    return (
      <div style={styles.root}>
        <div style={styles.toolbar}>
          <button style={styles.backBtn} onClick={back}>
            <ArrowLeft size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            Back
          </button>
          <span style={styles.title}>Add team member</span>
        </div>
        <div style={styles.formWrap}>
          <form onSubmit={handleAdd} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input style={styles.input} value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus disabled={busy} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password <span style={styles.hint}>(min 8 chars)</span></label>
              <input style={styles.input} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={busy} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm password</label>
              <input style={styles.input} type="password" value={newConfirm} onChange={e => setNewConfirm(e.target.value)} disabled={busy} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Role</label>
              <select style={styles.select} value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} disabled={busy}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Server access</label>
              <ServerAccessPicker value={newAccess} onChange={setNewAccess} />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            <div style={styles.btnRow}>
              <button type="button" style={styles.cancelBtn} onClick={back} disabled={busy}>Cancel</button>
              <button type="submit" style={styles.primaryBtn} disabled={busy}>
                {busy ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : 'Create user'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (view === 'edit' && editTarget) {
    return (
      <div style={styles.root}>
        <div style={styles.toolbar}>
          <button style={styles.backBtn} onClick={back}>
            <ArrowLeft size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            Back
          </button>
          <span style={styles.title}>Edit {editTarget.username}</span>
        </div>
        <div style={styles.formWrap}>
          <form onSubmit={handleEdit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Role</label>
              <select style={styles.select} value={editRole} onChange={e => setEditRole(e.target.value as UserRole)} disabled={busy}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Server access</label>
              <ServerAccessPicker value={editAccess} onChange={setEditAccess} />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            <div style={styles.btnRow}>
              <button type="button" style={styles.cancelBtn} onClick={back} disabled={busy}>Cancel</button>
              <button type="submit" style={styles.primaryBtn} disabled={busy}>
                {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (view === 'password' && editTarget) {
    return (
      <div style={styles.root}>
        <div style={styles.toolbar}>
          <button style={styles.backBtn} onClick={back}>
            <ArrowLeft size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            Back
          </button>
          <span style={styles.title}>Change password — {editTarget.username}</span>
        </div>
        <div style={styles.formWrap}>
          <form onSubmit={handlePassword} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>New password <span style={styles.hint}>(min 8 chars)</span></label>
              <input style={styles.input} type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} autoFocus disabled={busy} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm new password</label>
              <input style={styles.input} type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} disabled={busy} />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            <div style={styles.btnRow}>
              <button type="button" style={styles.cancelBtn} onClick={back} disabled={busy}>Cancel</button>
              <button type="submit" style={styles.primaryBtn} disabled={busy}>
                {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Change password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── User list ───────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.title}>Team</span>
          <span style={styles.count}>{users.length} {users.length === 1 ? 'member' : 'members'}</span>
        </div>
        <button style={styles.addBtn} onClick={openAdd}>
          <Plus size={13} /> Add member
        </button>
      </div>

      <div style={styles.listWrap}>
        {loading ? (
          <TeamPanelSkeleton />
        ) : loadError ? (
          <ErrorState
            title="Couldn't load team"
            description={loadError}
            onRetry={() => { setLoading(true); loadUsers() }}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Invite teammates to give them access to servers."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus />
                Add member
              </Button>
            }
          />
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Username</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Server access</th>
                <th style={styles.th}>Created</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={styles.username}>{u.username}</span>
                    {u.id === currentUser?.id && (
                      <span style={styles.youBadge}>you</span>
                    )}
                  </td>
                  <td style={styles.td}><Badge role={u.role} /></td>
                  <td style={{ ...styles.td, fontSize: '12px', color: 'var(--text-muted)' }}>
                    {u.serverAccess === '*'
                      ? 'All servers'
                      : u.serverAccess.length === 0
                      ? <span style={{ color: 'var(--error)' }}>None</span>
                      : `${u.serverAccess.length} server${u.serverAccess.length !== 1 ? 's' : ''}`}
                  </td>
                  <td style={{ ...styles.td, fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button style={styles.actionBtn} onClick={() => openEdit(u)} title="Edit role and access">
                        <Pencil size={11} /> Edit
                      </button>
                      <button style={styles.actionBtn} onClick={() => openPassword(u)} title="Change password">
                        <KeyRound size={11} /> Password
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          style={{ ...styles.actionBtn, color: 'var(--error)', borderColor: 'rgba(205, 20, 20, 0.30)' }}
                          onClick={() => handleDelete(u)}
                          title="Delete user"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  count: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  backBtn: {
    padding: '4px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    marginRight: '10px',
  },
  listWrap: {
    flex: 1,
    overflow: 'auto',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    height: '200px',
    gap: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  thead: {
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-secondary)',
    zIndex: 1,
  },
  th: {
    padding: '8px 16px',
    textAlign: 'left' as const,
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap' as const,
  },
  tr: {
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '10px 16px',
    verticalAlign: 'middle' as const,
  },
  username: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    marginRight: '6px',
  },
  youBadge: {
    display: 'inline-block',
    fontSize: '10px',
    padding: '1px 6px',
    background: 'var(--accent-dim)',
    color: 'var(--accent-hover)',
    border: '1px solid var(--accent-glow)',
    borderRadius: '4px',
    fontWeight: 500,
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  formWrap: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  form: {
    width: '480px',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  hint: {
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  },
  select: {
    padding: '8px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  errorBox: {
    fontSize: '12px',
    color: 'var(--error)',
    padding: '8px 12px',
    background: 'rgba(205, 20, 20, 0.08)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(205, 20, 20, 0.20)',
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '4px',
  },
  cancelBtn: {
    padding: '8px 18px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
}

// Skeleton rows roughly shaped like the team member table.
function TeamPanelSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-[140px]" />
          <Skeleton className="h-4 w-[72px] rounded" />
          <Skeleton className="h-3 w-[110px]" />
          <Skeleton className="h-3 w-[90px]" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
    </div>
  )
}
