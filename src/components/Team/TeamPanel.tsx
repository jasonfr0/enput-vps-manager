import React, { FormEvent, useEffect, useState } from 'react'
import { TeamUser, UserRole } from '../../types/api'
import { useSessionStore, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../context/useSessionStore'
import { useConnectionStore } from '../../context/useConnectionStore'

type View = 'list' | 'add' | 'edit' | 'password'

const ROLES: UserRole[] = ['admin', 'operator', 'readonly']

function Badge({ role }: { role: UserRole }) {
  const colors: Record<UserRole, string> = {
    admin:    '#6c63ff',
    operator: '#4caf50',
    readonly: '#ff9800',
  }
  const c = colors[role]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      background: c + '22',
      color: c,
      border: `1px solid ${c}55`,
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
    try {
      const list = await usersApi.list()
      setUsers(list)
    } catch (e: any) {
      console.error('[TeamPanel] loadUsers:', e)
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
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    try {
      await usersApi.delete(u.id)
      await loadUsers()
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete user')
    }
  }

  // ── Server access toggle helper ─────────────────────────────────────────────

  function ServerAccessPicker({
    value, onChange
  }: { value: '*' | string[]; onChange: (v: '*' | string[]) => void }) {
    if (servers.length === 0) {
      return <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No servers configured yet.</p>
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
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔒</div>
          <p>Admin access required to manage team members.</p>
        </div>
      </div>
    )
  }

  if (view === 'add') {
    return (
      <div style={styles.root}>
        <div style={styles.toolbar}>
          <button style={styles.backBtn} onClick={back}>← Back</button>
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
              <button type="submit" style={styles.primaryBtn} disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
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
          <button style={styles.backBtn} onClick={back}>← Back</button>
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
              <button type="submit" style={styles.primaryBtn} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
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
          <button style={styles.backBtn} onClick={back}>← Back</button>
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
              <button type="submit" style={styles.primaryBtn} disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
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
        <button style={styles.addBtn} onClick={openAdd}>+ Add member</button>
      </div>

      <div style={styles.listWrap}>
        {users.length === 0 ? (
          <div style={styles.center}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No users yet.</p>
          </div>
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
                      ? <span style={{ color: '#f44336' }}>None</span>
                      : `${u.serverAccess.length} server${u.serverAccess.length !== 1 ? 's' : ''}`}
                  </td>
                  <td style={{ ...styles.td, fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button style={styles.actionBtn} onClick={() => openEdit(u)}>Edit</button>
                      <button style={styles.actionBtn} onClick={() => openPassword(u)}>Password</button>
                      {u.id !== currentUser?.id && (
                        <button style={{ ...styles.actionBtn, color: '#f44336' }} onClick={() => handleDelete(u)}>Delete</button>
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
    background: 'var(--accent)22',
    color: 'var(--accent)',
    border: '1px solid var(--accent)55',
    borderRadius: '4px',
    fontWeight: 500,
  },
  actionBtn: {
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
    color: '#f44336',
    padding: '8px 12px',
    background: 'rgba(244,67,54,0.1)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(244,67,54,0.25)',
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
