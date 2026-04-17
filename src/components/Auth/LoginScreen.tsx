import React, { FormEvent, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../context/useSessionStore'

interface LoginScreenProps {
  /** If true, show the first-run admin account creation form instead */
  setupMode?: boolean
  onSetupDone?: () => void
}

type AuthMode = 'detecting' | 'local' | 'remote'

export function LoginScreen({ setupMode = false, onSetupDone }: LoginScreenProps) {
  const setCurrentUser = useSessionStore((s) => s.setCurrentUser)
  const setRemote      = useSessionStore((s) => s.setRemote)

  // Auth mode detection
  const [authMode, setAuthMode]         = useState<AuthMode>('detecting')
  const [serverUrl, setServerUrl]       = useState<string>('')
  const [silentChecking, setSilentCheck] = useState(false)

  // "Use auth server" inline configurator (shown on local login screen)
  const [showUrlInput, setShowUrlInput]   = useState(false)
  const [urlInputVal, setUrlInputVal]     = useState('')
  const [urlSaving, setUrlSaving]         = useState(false)
  const [urlError, setUrlError]           = useState('')
  const detectRef = useRef<() => void>()

  // Shared form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)

  // Setup state (first run, local mode only)
  const [setupUsername, setSetupUsername] = useState('admin')
  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirm, setSetupConfirm]   = useState('')
  const [setupError, setSetupError]       = useState('')
  const [setupBusy, setSetupBusy]         = useState(false)

  // On mount: detect whether a remote auth server is configured
  useEffect(() => {
    if (setupMode) {
      setAuthMode('local')
      return
    }

    let cancelled = false

    async function detectMode() {
      setAuthMode('detecting')
      try {
        const url = await window.api.authServer.getUrl()
        if (cancelled) return

        if (url) {
          setServerUrl(url)
          setAuthMode('remote')

          // Attempt silent token refresh for auto-login
          setSilentCheck(true)
          try {
            const user = await window.api.authServer.refresh()
            if (cancelled) return
            if (user) {
              setRemote(true)
              setCurrentUser(user as any)
              return
            }
          } catch {
            // Refresh failed — show remote login form
          } finally {
            if (!cancelled) setSilentCheck(false)
          }
        } else {
          setAuthMode('local')
        }
      } catch {
        if (!cancelled) setAuthMode('local')
      }
    }

    // Store ref so the URL-save handler can re-trigger detection
    detectRef.current = detectMode

    detectMode()
    return () => { cancelled = true }
  }, [setupMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save an auth server URL entered directly on the login screen, then re-detect
  const handleSaveUrl = async () => {
    const trimmed = urlInputVal.trim().replace(/\/$/, '')
    if (!trimmed) { setUrlError('Enter a URL'); return }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlError('URL must start with http:// or https://')
      return
    }
    setUrlSaving(true)
    setUrlError('')
    try {
      await window.api.authServer.setUrl(trimmed)
      setShowUrlInput(false)
      setUrlInputVal('')
      detectRef.current?.()
    } catch (e: any) {
      setUrlError(e?.message ?? 'Failed to save')
    } finally {
      setUrlSaving(false)
    }
  }

  // ── LOCAL LOGIN ────────────────────────────────────────────────────────────
  const handleLocalLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      const user = await window.api.users.authenticate(username.trim(), password)
      setCurrentUser(user)
    } catch (err: any) {
      setError(err?.message ?? 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  // ── REMOTE LOGIN ───────────────────────────────────────────────────────────
  const handleRemoteLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      const user = await window.api.authServer.login(username.trim(), password)
      setRemote(true)
      setCurrentUser(user as any)
    } catch (err: any) {
      setError(err?.message ?? 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  // ── FIRST-RUN SETUP ────────────────────────────────────────────────────────
  const handleSetup = async (e: FormEvent) => {
    e.preventDefault()
    setSetupError('')
    if (!setupUsername.trim()) { setSetupError('Username is required'); return }
    if (setupPassword.length < 8) { setSetupError('Password must be at least 8 characters'); return }
    if (setupPassword !== setupConfirm) { setSetupError('Passwords do not match'); return }
    setSetupBusy(true)
    try {
      const user = await window.api.users.create(
        setupUsername.trim(),
        setupPassword,
        'admin',
        '*'
      )
      setCurrentUser(user)
      onSetupDone?.()
    } catch (err: any) {
      setSetupError(err?.message ?? 'Setup failed')
    } finally {
      setSetupBusy(false)
    }
  }

  // ── RENDER: detecting / silent refresh ────────────────────────────────────
  if (authMode === 'detecting' || silentChecking) {
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.card, textAlign: 'center' }}>
          <div style={styles.logoRow}>
            <span style={styles.logoIcon}>⚡</span>
            <span style={styles.logoText}>Enput VPS</span>
          </div>
          <div style={styles.spinner}>◌</div>
          <p style={{ ...styles.sub, marginTop: '12px' }}>
            {silentChecking ? 'Restoring session…' : 'Checking configuration…'}
          </p>
        </div>
      </div>
    )
  }

  // ── RENDER: first-run setup ────────────────────────────────────────────────
  if (setupMode) {
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <span style={styles.logoIcon}>⚡</span>
            <span style={styles.logoText}>Enput VPS</span>
          </div>
          <h1 style={styles.heading}>Welcome — Set up your admin account</h1>
          <p style={styles.sub}>
            This is your first time launching the app. Create an admin account to get started.
          </p>
          <form onSubmit={handleSetup} style={styles.form}>
            <label style={styles.label}>Admin username</label>
            <input
              style={styles.input}
              value={setupUsername}
              onChange={e => setSetupUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={setupBusy}
            />
            <label style={styles.label}>Password <span style={styles.hint}>(min 8 characters)</span></label>
            <input
              style={styles.input}
              type="password"
              value={setupPassword}
              onChange={e => setSetupPassword(e.target.value)}
              autoComplete="new-password"
              disabled={setupBusy}
            />
            <label style={styles.label}>Confirm password</label>
            <input
              style={styles.input}
              type="password"
              value={setupConfirm}
              onChange={e => setSetupConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={setupBusy}
            />
            {setupError && <div style={styles.error}>{setupError}</div>}
            <button style={styles.btn} type="submit" disabled={setupBusy}>
              {setupBusy ? 'Creating account…' : 'Create admin account'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── RENDER: remote login ───────────────────────────────────────────────────
  if (authMode === 'remote') {
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <span style={styles.logoIcon}>⚡</span>
            <span style={styles.logoText}>Enput VPS</span>
          </div>
          <h1 style={styles.heading}>Sign in</h1>
          <div style={styles.serverBadge}>
            <span style={styles.serverBadgeDot} />
            <span style={styles.serverBadgeText} title={serverUrl}>
              {serverUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
          <form onSubmit={handleRemoteLogin} style={styles.form}>
            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={busy}
            />
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
            {error && <div style={styles.error}>{error}</div>}
            <button style={styles.btn} type="submit" disabled={busy || !username.trim() || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p style={styles.modeNote}>
            Authenticated via team server
          </p>
        </div>
      </div>
    )
  }

  // ── RENDER: local login ────────────────────────────────────────────────────
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logoIcon}>⚡</span>
          <span style={styles.logoText}>Enput VPS</span>
        </div>
        <h1 style={styles.heading}>Sign in</h1>
        <form onSubmit={handleLocalLogin} style={styles.form}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            disabled={busy}
          />
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={busy}
          />
          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.btn} type="submit" disabled={busy || !username.trim() || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* ── Auth server quick-connect ── */}
        <div style={styles.divider} />
        {!showUrlInput ? (
          <button
            style={styles.linkBtn}
            onClick={() => { setShowUrlInput(true); setUrlError('') }}
          >
            Use a team auth server
          </button>
        ) : (
          <div style={styles.urlBox}>
            <p style={styles.urlBoxLabel}>Auth server URL</p>
            <input
              style={styles.input}
              placeholder="https://vpsadmin.example.com"
              value={urlInputVal}
              onChange={e => setUrlInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveUrl() } }}
              autoFocus
              disabled={urlSaving}
            />
            {urlError && <div style={{ ...styles.error, marginTop: '4px' }}>{urlError}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button style={styles.btn} onClick={handleSaveUrl} disabled={urlSaving || !urlInputVal.trim()}>
                {urlSaving ? 'Connecting…' : 'Connect'}
              </button>
              <button style={styles.btnGhost} onClick={() => { setShowUrlInput(false); setUrlError('') }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    zIndex: 9999,
  },
  card: {
    width: '360px',
    background: 'var(--bg-secondary)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    padding: '36px 32px 28px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  logoIcon: { fontSize: '22px' },
  logoText: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  heading: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 10px',
  },
  sub: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '2px',
  },
  hint: {
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  input: {
    padding: '9px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    marginBottom: '6px',
  },
  error: {
    fontSize: '12px',
    color: '#f44336',
    padding: '6px 10px',
    background: 'rgba(244,67,54,0.1)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(244,67,54,0.25)',
  },
  btn: {
    flex: 1,
    marginTop: '8px',
    padding: '10px 0',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 1,
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '20px 0 12px',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '0',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted' as const,
  },
  urlBox: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  urlBoxLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  btnGhost: {
    flex: 1,
    padding: '10px 0',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  serverBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '16px',
    padding: '5px 10px',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '20px',
    width: 'fit-content',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  serverBadgeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#6366f1',
    flexShrink: 0,
  },
  serverBadgeText: {
    fontSize: '11px',
    color: '#818cf8',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  modeNote: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: '16px',
    marginBottom: 0,
  },
  spinner: {
    fontSize: '32px',
    color: 'var(--accent)',
    animation: 'spin 1s linear infinite',
    display: 'inline-block',
    marginTop: '12px',
  },
}
