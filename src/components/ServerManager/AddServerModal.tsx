import React, { useState } from 'react'
import { useConnectionStore } from '../../context/useConnectionStore'

interface AddServerModalProps {
  onClose: () => void
}

export function AddServerModal({ onClose }: AddServerModalProps) {
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('root')
  const [authType, setAuthType] = useState<'key' | 'password'>('key')
  const [privateKeyPath, setPrivateKeyPath] = useState('')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState('')

  const handleSelectKey = async () => {
    const result = await window.api.dialog.openFile({
      title: 'Select SSH Private Key',
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }],
    })
    if (!result.canceled && result.filePaths[0]) {
      setPrivateKeyPath(result.filePaths[0])
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    setError('')
    setTestResult('')
    try {
      // Save temporarily, then connect
      const config = {
        id: `test_${Date.now()}`,
        name: name || 'Test',
        host,
        port: parseInt(port),
        username,
        authType,
        privateKeyPath: authType === 'key' ? privateKeyPath : undefined,
        password: authType === 'password' ? password : undefined,
        passphrase: passphrase || undefined,
      }

      await window.api.servers.add(config)
      const state = await window.api.ssh.connect(config.id)

      if (state.status === 'connected') {
        setTestResult('Connection successful!')
        await window.api.ssh.disconnect(state.id)
      }

      // Remove test server
      await window.api.servers.delete(config.id)
    } catch (err: any) {
      setError(`Connection failed: ${err.message}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!name || !host || !username) {
      setError('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const config = {
        id: '',
        name,
        host,
        port: parseInt(port),
        username,
        authType,
        privateKeyPath: authType === 'key' ? privateKeyPath : undefined,
        password: authType === 'password' ? password : undefined,
        passphrase: passphrase || undefined,
      }

      const saved = await window.api.servers.add(config)
      useConnectionStore.getState().addServer(saved)
      onClose()
    } catch (err: any) {
      setError(`Save failed: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Add Server</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            X
          </button>
        </div>

        <div style={styles.body}>
          {/* Name */}
          <div style={styles.field}>
            <label style={styles.label}>Name *</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My VPS Server"
            />
          </div>

          {/* Host + Port */}
          <div style={styles.row}>
            <div style={{ ...styles.field, flex: 3 }}>
              <label style={styles.label}>Host *</label>
              <input
                style={styles.input}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1 or domain.com"
              />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Port</label>
              <input
                style={styles.input}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
                type="number"
              />
            </div>
          </div>

          {/* Username */}
          <div style={styles.field}>
            <label style={styles.label}>Username *</label>
            <input
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
            />
          </div>

          {/* Auth type */}
          <div style={styles.field}>
            <label style={styles.label}>Authentication</label>
            <div style={styles.authToggle}>
              <button
                style={{
                  ...styles.authBtn,
                  ...(authType === 'key' ? styles.authBtnActive : {}),
                }}
                onClick={() => setAuthType('key')}
              >
                SSH Key
              </button>
              <button
                style={{
                  ...styles.authBtn,
                  ...(authType === 'password' ? styles.authBtnActive : {}),
                }}
                onClick={() => setAuthType('password')}
              >
                Password
              </button>
            </div>
          </div>

          {/* Key or password */}
          {authType === 'key' ? (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Private Key File</label>
                <div style={styles.filePickerRow}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    placeholder="/path/to/id_rsa"
                    readOnly
                  />
                  <button style={styles.browseBtn} onClick={handleSelectKey}>
                    Browse
                  </button>
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Key Passphrase (optional)</label>
                <input
                  style={styles.input}
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Passphrase for encrypted keys"
                />
              </div>
            </>
          ) : (
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Server password"
              />
            </div>
          )}

          {/* Error / success */}
          {error && <div style={styles.error}>{error}</div>}
          {testResult && <div style={styles.success}>{testResult}</div>}
        </div>

        <div style={styles.footer}>
          <button
            style={styles.testBtn}
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <div style={styles.footerRight}>
            <button style={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              style={styles.saveBtn}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '480px',
    maxHeight: '90vh',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
  },
  body: {
    padding: '20px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
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
  input: {
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  row: {
    display: 'flex',
    gap: '10px',
  },
  authToggle: {
    display: 'flex',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
  },
  authBtn: {
    flex: 1,
    padding: '8px',
    border: 'none',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  authBtnActive: {
    background: 'var(--accent)',
    color: '#fff',
  },
  filePickerRow: {
    display: 'flex',
    gap: '8px',
  },
  browseBtn: {
    padding: '8px 16px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  error: {
    padding: '8px 12px',
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.3)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--error)',
    fontSize: '12px',
  },
  success: {
    padding: '8px 12px',
    background: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--success)',
    fontSize: '12px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    borderTop: '1px solid var(--border)',
  },
  testBtn: {
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  footerRight: {
    display: 'flex',
    gap: '8px',
  },
  cancelBtn: {
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
}
