import React, { useState } from 'react'
import { FolderOpen, KeyRound, Lock, Loader2, Check, AlertTriangle, Server } from 'lucide-react'

import { useConnectionStore } from '../../context/useConnectionStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AddServerModalProps {
  onClose: () => void
}

/**
 * Add Server modal — uses shadcn Dialog for overlay/escape/focus-trap and
 * shadcn Input/Button primitives for consistent styling. Logic (test +
 * save) is unchanged from the previous hand-rolled version.
 */
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
    if (!host || !username) {
      setError('Host and username are required to test')
      return
    }

    setIsTesting(true)
    setError('')
    setTestResult('')

    let savedServer: any = null
    try {
      // Save temporarily, then connect
      const config = {
        id: '',
        name: name || 'Test Connection',
        host,
        port: parseInt(port),
        username,
        authType,
        privateKeyPath: authType === 'key' ? privateKeyPath : undefined,
        password: authType === 'password' ? password : undefined,
        passphrase: passphrase || undefined,
      }

      // Use the returned server (which has the real ID assigned by the backend)
      savedServer = await window.api.servers.add(config)
      const state = await window.api.ssh.connect(savedServer.id)

      if (state.status === 'connected') {
        setTestResult('Connection successful!')
        await window.api.ssh.disconnect(state.id)
      }
    } catch (err: any) {
      setError(`Connection failed: ${err.message}`)
    } finally {
      // Always clean up the temp server
      if (savedServer?.id) {
        try {
          await window.api.servers.delete(savedServer.id)
        } catch {
          // ignore cleanup errors
        }
      }
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--accent-dim)] text-[color:var(--accent)]">
              <Server className="size-3.5" />
            </span>
            <div className="flex flex-col gap-0.5 text-left">
              <DialogTitle>Add Server</DialogTitle>
              <DialogDescription>SSH connection details for a new VPS.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3.5 px-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <Field label="Display name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My VPS Server"
              autoFocus
            />
          </Field>

          {/* Host + Port */}
          <div className="flex gap-2.5">
            <div className="flex-[3]">
              <Field label="Host" required>
                <Input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.1 or domain.com"
                />
              </Field>
            </div>
            <div className="flex-1 min-w-[80px]">
              <Field label="Port">
                <Input
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="22"
                  type="number"
                  inputMode="numeric"
                />
              </Field>
            </div>
          </div>

          {/* Username */}
          <Field label="Username" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
            />
          </Field>

          {/* Auth type — segmented toggle */}
          <Field label="Authentication">
            <div
              role="tablist"
              className="grid grid-cols-2 gap-1 rounded-md bg-[color:var(--bg-tertiary)] p-1"
            >
              <SegmentBtn
                active={authType === 'key'}
                onClick={() => setAuthType('key')}
                icon={<KeyRound className="size-3.5" />}
                label="SSH Key"
              />
              <SegmentBtn
                active={authType === 'password'}
                onClick={() => setAuthType('password')}
                icon={<Lock className="size-3.5" />}
                label="Password"
              />
            </div>
          </Field>

          {/* Key or password */}
          {authType === 'key' ? (
            <>
              <Field label="Private key file">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    placeholder="/path/to/id_rsa"
                    readOnly
                  />
                  <Button variant="outline" size="default" onClick={handleSelectKey} className="gap-1.5">
                    <FolderOpen className="size-3.5" />
                    Browse
                  </Button>
                </div>
              </Field>
              <Field label="Key passphrase" hint="Leave blank if your key isn't encrypted.">
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </>
          ) : (
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Server password"
              />
            </Field>
          )}

          {/* Inline status */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-[rgba(205,20,20,0.20)] bg-[rgba(205,20,20,0.08)] px-3 py-2 text-xs text-[color:var(--error)]">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {testResult && (
            <div className="flex items-start gap-2 rounded-md border border-[rgba(0,181,120,0.25)] bg-[rgba(0,181,120,0.10)] px-3 py-2 text-xs text-[color:var(--success)]">
              <Check className="size-3.5 shrink-0 mt-0.5" />
              <span>{testResult}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row !justify-between border-t border-border px-5 py-3">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || isSaving}
            className="gap-1.5"
          >
            {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isTesting ? 'Testing…' : 'Test connection'}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isTesting} className="gap-1.5">
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {isSaving ? 'Saving…' : 'Save server'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Local helpers ───────────────────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}

function Field({ label, required, hint, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-[color:var(--accent)]">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

interface SegmentBtnProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function SegmentBtn({ active, onClick, icon, label }: SegmentBtnProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-[color:var(--bg-secondary)] text-[color:var(--text-primary)] shadow-sm'
          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]')
      }
    >
      {icon}
      {label}
    </button>
  )
}
