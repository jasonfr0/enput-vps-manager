import React, { useState, useEffect } from 'react'
import { useSettingsStore, AppSettings } from '../../context/useSettingsStore'
import { useUpdateStore } from '../../context/useUpdateStore'
import { SSHKeyPanel } from '../SSHKeys/SSHKeyPanel'

const TAB_OPTIONS = [
  { value: 'terminal',   label: 'Terminal' },
  { value: 'files',      label: 'Files' },
  { value: 'editor',     label: 'Editor' },
  { value: 'chat',       label: 'Claude Chat' },
  { value: 'claude-cli', label: 'Claude Code' },
  { value: 'monitor',    label: 'Monitor' },
]

// ─── Small reusable controls ────────────────────────────────────
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={s.row}>
      <div style={s.rowLabel}>
        <span style={s.label}>{label}</span>
        {hint && <span style={s.hint}>{hint}</span>}
      </div>
      <div style={s.rowControl}>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      style={{ ...s.toggle, background: value ? 'var(--accent)' : 'var(--bg-tertiary)' }}
      onClick={() => onChange(!value)}
      aria-label={value ? 'On' : 'Off'}
    >
      <div style={{ ...s.toggleKnob, transform: value ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  )
}

function Slider({
  value, min, max, step = 1, onChange, format,
}: {
  value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={s.slider}
      />
      <span style={s.sliderValue}>{format ? format(value) : value}</span>
    </div>
  )
}

function Select({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select style={s.select} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── About version row with update check button ───────────────────
function AboutVersionRow() {
  const { status, version, check } = useUpdateStore()
  // app version injected by Vite/electron-vite at build time
  const appVersion: string = (import.meta as any).env?.VITE_APP_VERSION ?? '1.1.0'
  const isPackaged = !((import.meta as any).env?.DEV)

  const statusLabel: Record<string, string> = {
    checking:        'Checking…',
    available:       `v${version} available`,
    downloading:     'Downloading…',
    ready:           `v${version} ready to install`,
    'not-available': 'Up to date',
    error:           'Check failed',
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const }}>
      <span style={s.mutedText}>v{appVersion}</span>
      {status !== 'idle' && status !== 'checking' && (
        <span style={{
          fontSize: '11px',
          color: status === 'available' || status === 'ready' ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          {statusLabel[status] ?? ''}
        </span>
      )}
      <button
        style={{ ...s.smallBtn, opacity: (status === 'checking' || !isPackaged) ? 0.6 : 1 }}
        onClick={() => check()}
        disabled={status === 'checking' || status === 'downloading'}
        title={!isPackaged ? 'Update checks only work in the packaged app (npm run release:win)' : undefined}
      >
        {status === 'checking' ? 'Checking…' : 'Check for updates'}
      </button>
      {!isPackaged && (
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          (dev build)
        </span>
      )}
    </span>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>{title}</div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────
export function SettingsPanel() {
  const settings = useSettingsStore()
  const { update, reset } = settings

  // API key state (managed separately via IPC)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)

  useEffect(() => {
    try {
      window.api.claude.getApiKey()
        .then((has: boolean) => setHasApiKey(has))
        .catch(() => setHasApiKey(false))
    } catch {
      setHasApiKey(false)
    }
  }, [])

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return
    try {
      await window.api.claude.setApiKey(apiKeyInput.trim())
      setHasApiKey(true)
      setShowApiKeyInput(false)
      setApiKeyInput('')
      setApiKeySaved(true)
      setTimeout(() => setApiKeySaved(false), 2000)
    } catch (err: any) {
      console.error('Failed to save API key:', err)
    }
  }

  return (
    <div style={s.container}>
      {/* Fixed header */}
      <div style={s.header}>
        <h2 style={s.title}>Settings</h2>
        <button
          style={s.resetBtn}
          onClick={() => { if (confirm('Reset all settings to defaults?')) reset() }}
        >
          Reset to defaults
        </button>
      </div>

      {/* Scrollable body — full width, centers content with maxWidth inside */}
      <div style={s.scrollArea}>
        <div style={s.innerContent}>

          {/* ── General ── */}
          <Section title="General">
            <Row label="Default tab" hint="Which tab opens on app launch">
              <Select
                value={settings.defaultTab}
                options={TAB_OPTIONS}
                onChange={(v) => update({ defaultTab: v as AppSettings['defaultTab'] })}
              />
            </Row>
            <Row label="Auto-connect on launch" hint="Reconnect to the last active server automatically">
              <Toggle value={settings.autoConnectLast} onChange={(v) => update({ autoConnectLast: v })} />
            </Row>
          </Section>

          {/* ── Editor ── */}
          <Section title="Code Editor">
            <Row label="Font size" hint="Monaco editor font size">
              <Slider
                value={settings.editorFontSize}
                min={10} max={22}
                onChange={(v) => update({ editorFontSize: v })}
                format={(v) => `${v}px`}
              />
            </Row>
            <Row label="Tab size" hint="Spaces per indent level">
              <Select
                value={String(settings.editorTabSize)}
                options={[{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }]}
                onChange={(v) => update({ editorTabSize: Number(v) as 2 | 4 })}
              />
            </Row>
            <Row label="Word wrap" hint="Wrap long lines in the editor">
              <Toggle value={settings.editorWordWrap} onChange={(v) => update({ editorWordWrap: v })} />
            </Row>
            <Row label="Minimap" hint="Show the code minimap overview panel">
              <Toggle value={settings.editorMinimap} onChange={(v) => update({ editorMinimap: v })} />
            </Row>
            <Row label="Font ligatures" hint="Render ligatures in monospace fonts (e.g. → ≠ ===)">
              <Toggle value={settings.editorLigatures} onChange={(v) => update({ editorLigatures: v })} />
            </Row>
          </Section>

          {/* ── Terminal ── */}
          <Section title="Terminal">
            <Row label="Font size" hint="Terminal font size in pixels">
              <Slider
                value={settings.terminalFontSize}
                min={10} max={22}
                onChange={(v) => update({ terminalFontSize: v })}
                format={(v) => `${v}px`}
              />
            </Row>
            <Row label="Scrollback" hint="Number of lines kept in terminal history">
              <Select
                value={String(settings.terminalScrollback)}
                options={[
                  { value: '1000',  label: '1,000 lines' },
                  { value: '5000',  label: '5,000 lines' },
                  { value: '10000', label: '10,000 lines' },
                  { value: '50000', label: '50,000 lines' },
                ]}
                onChange={(v) => update({ terminalScrollback: Number(v) })}
              />
            </Row>
            <Row label="Cursor style">
              <Select
                value={settings.terminalCursorStyle}
                options={[
                  { value: 'bar',       label: 'Bar (|)' },
                  { value: 'block',     label: 'Block (█)' },
                  { value: 'underline', label: 'Underline (_)' },
                ]}
                onChange={(v) => update({ terminalCursorStyle: v as AppSettings['terminalCursorStyle'] })}
              />
            </Row>
            <Row label="Cursor blink">
              <Toggle value={settings.terminalCursorBlink} onChange={(v) => update({ terminalCursorBlink: v })} />
            </Row>
          </Section>

          {/* ── Claude AI ── */}
          <Section title="Claude AI">
            <Row
              label="Anthropic API key"
              hint="Used for Claude Chat. Stored securely on this machine."
            >
              <div style={s.apiKeyCell}>
                {!showApiKeyInput ? (
                  <div style={s.apiKeyStatus}>
                    <span style={{
                      ...s.apiKeyStatusText,
                      color: hasApiKey ? 'var(--success)' : 'var(--text-muted)',
                    }}>
                      {hasApiKey === null
                        ? 'Checking...'
                        : hasApiKey
                        ? '● Key saved'
                        : '○ No key set'}
                    </span>
                    <button style={s.smallBtn} onClick={() => setShowApiKeyInput(true)}>
                      {hasApiKey ? 'Change key' : 'Set key'}
                    </button>
                    {apiKeySaved && (
                      <span style={{ fontSize: '12px', color: 'var(--success)' }}>Saved!</span>
                    )}
                  </div>
                ) : (
                  <div style={s.apiKeyForm}>
                    <input
                      type="password"
                      style={s.apiKeyInput}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveApiKey() }}
                      placeholder="sk-ant-..."
                      autoFocus
                    />
                    <button style={s.saveBtn} onClick={handleSaveApiKey}>Save</button>
                    <button
                      style={s.cancelBtn}
                      onClick={() => { setShowApiKeyInput(false); setApiKeyInput('') }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </Row>
          </Section>

          {/* ── SSH Keys ── */}
          <Section title="SSH Key Management">
            <div style={{ padding: '12px 16px' }}>
              <SSHKeyPanel />
            </div>
          </Section>

          {/* ── About ── */}
          <Section title="About">
            <Row label="Version">
              <AboutVersionRow />
            </Row>
            <Row label="Built with">
              <span style={s.mutedText}>
                Electron · React · TypeScript · Monaco · xterm.js
              </span>
            </Row>
          </Section>

        </div>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  resetBtn: {
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  // Full-width scrollable area — content is centered inside
  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    width: '100%',
  },
  // Centered inner wrapper that caps width and adds padding
  innerContent: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '24px 24px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxSizing: 'border-box' as const,
    width: '100%',
  },
  section: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
  },
  sectionBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    gap: '16px',
    minWidth: 0,
  },
  rowLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap' as const,
  },
  hint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    whiteSpace: 'normal' as const,
    lineHeight: 1.4,
  },
  rowControl: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  toggle: {
    position: 'relative',
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    transition: 'background 200ms ease',
  },
  toggleKnob: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 200ms ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
  slider: {
    width: '140px',
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  },
  sliderValue: {
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    width: '36px',
    textAlign: 'right' as const,
  },
  select: {
    padding: '5px 8px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
  },
  // Claude AI key styles
  apiKeyCell: {
    display: 'flex',
    alignItems: 'center',
  },
  apiKeyStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  apiKeyStatusText: {
    fontSize: '12px',
    whiteSpace: 'nowrap' as const,
  },
  apiKeyForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  apiKeyInput: {
    padding: '6px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    width: '200px',
    outline: 'none',
  },
  smallBtn: {
    padding: '4px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  saveBtn: {
    padding: '5px 12px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  cancelBtn: {
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  mutedText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
}
