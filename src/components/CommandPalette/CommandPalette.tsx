import React, { useEffect, useState } from 'react'
import {
  Server,
  Plug,
  Plus,
  Settings as SettingsIcon,
  Users,
  ScrollText,
  Activity,
  Terminal as TerminalIcon,
  Folder,
  Code2,
  MessageSquare,
  Bot,
  LogOut,
  KeyRound,
} from 'lucide-react'

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useConnectionStore } from '@/context/useConnectionStore'
import { useSessionStore } from '@/context/useSessionStore'
import type { ActiveTab } from '@/App'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTabChange: (tab: ActiveTab) => void
  onAddServer: () => void
}

/**
 * Global ⌘K command palette.
 * Searches across servers, navigation tabs, and quick actions.
 *
 * Visibility of items respects role + connection state — e.g. terminal
 * navigation only appears when an SSH session is live, and Team appears
 * only for admins.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onTabChange,
  onAddServer,
}: CommandPaletteProps) {
  const { servers, activeServerId, connectionStatus } = useConnectionStore()
  const { currentUser, canAccessServer, isAdmin, isOperator, logout } = useSessionStore()
  const [search, setSearch] = useState('')

  // Reset search whenever the palette opens, so stale text doesn't
  // greet the user on the next invocation.
  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  // Run a command then close the palette.
  const run = (fn: () => void) => () => {
    fn()
    onOpenChange(false)
  }

  const isConnected = connectionStatus === 'connected'
  const accessibleServers = servers.filter((s) => canAccessServer(s.id))

  const handleConnect = (serverId: string) => {
    useConnectionStore.getState().setConnectionStatus('connecting')
    window.api.ssh
      .connect(serverId)
      .catch((err: any) => {
        console.error('[CommandPalette] Connect failed:', err)
        useConnectionStore.getState().setError('Connect failed: ' + err.message)
      })
  }

  const handleDisconnect = () => {
    if (!isConnected) return
    const id = useConnectionStore.getState().activeConnId
    if (!id) return
    window.api.ssh.disconnect(id).catch((err: any) => {
      console.error('[CommandPalette] Disconnect failed:', err)
    })
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command or search…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {accessibleServers.length > 0 && (
          <CommandGroup heading="Servers">
            {accessibleServers.map((server) => {
              const isActive = server.id === activeServerId && isConnected
              return (
                <CommandItem
                  key={server.id}
                  value={`server ${server.name} ${server.host} ${server.username}`}
                  onSelect={run(() => handleConnect(server.id))}
                >
                  <Server />
                  <span>{server.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {server.username}@{server.host}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-xs font-medium text-[color:var(--accent)]">
                      Connected
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {isConnected && (
            <>
              <CommandItem
                value="navigate terminal ssh shell"
                onSelect={run(() => onTabChange('terminal'))}
              >
                <TerminalIcon />
                <span>Terminal</span>
                <CommandShortcut>Ctrl 1</CommandShortcut>
              </CommandItem>
              <CommandItem
                value="navigate files sftp upload download"
                onSelect={run(() => onTabChange('files'))}
              >
                <Folder />
                <span>Files</span>
                <CommandShortcut>Ctrl 2</CommandShortcut>
              </CommandItem>
              {isOperator() && (
                <CommandItem
                  value="navigate editor monaco code"
                  onSelect={run(() => onTabChange('editor'))}
                >
                  <Code2 />
                  <span>Code Editor</span>
                  <CommandShortcut>Ctrl 3</CommandShortcut>
                </CommandItem>
              )}
              {isOperator() && (
                <CommandItem
                  value="navigate chat claude assistant"
                  onSelect={run(() => onTabChange('chat'))}
                >
                  <MessageSquare />
                  <span>Claude Chat</span>
                  <CommandShortcut>Ctrl 4</CommandShortcut>
                </CommandItem>
              )}
              {isOperator() && (
                <CommandItem
                  value="navigate claude code cli agent"
                  onSelect={run(() => onTabChange('claude-cli'))}
                >
                  <Bot />
                  <span>Claude Code</span>
                  <CommandShortcut>Ctrl 5</CommandShortcut>
                </CommandItem>
              )}
              <CommandItem
                value="navigate monitor resources cpu memory"
                onSelect={run(() => onTabChange('monitor'))}
              >
                <Activity />
                <span>Resource Monitor</span>
                <CommandShortcut>Ctrl 6</CommandShortcut>
              </CommandItem>
            </>
          )}
          <CommandItem
            value="navigate audit log history"
            onSelect={run(() => onTabChange('audit'))}
          >
            <ScrollText />
            <span>Audit Log</span>
            <CommandShortcut>Ctrl 7</CommandShortcut>
          </CommandItem>
          {isAdmin() && (
            <CommandItem
              value="navigate team users members"
              onSelect={run(() => onTabChange('team'))}
            >
              <Users />
              <span>Team</span>
            </CommandItem>
          )}
          <CommandItem
            value="navigate settings preferences"
            onSelect={run(() => onTabChange('settings'))}
          >
            <SettingsIcon />
            <span>Settings</span>
            <CommandShortcut>Ctrl ,</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="action add new server"
            onSelect={run(onAddServer)}
          >
            <Plus />
            <span>Add new server…</span>
          </CommandItem>
          {isConnected && (
            <CommandItem
              value="action disconnect ssh session"
              onSelect={run(handleDisconnect)}
            >
              <Plug />
              <span>Disconnect current session</span>
            </CommandItem>
          )}
          {isAdmin() && (
            <CommandItem
              value="action manage ssh keys"
              onSelect={run(() => onTabChange('settings'))}
            >
              <KeyRound />
              <span>Manage SSH keys (Settings)</span>
            </CommandItem>
          )}
          {currentUser && (
            <CommandItem
              value="action sign out logout"
              onSelect={run(() => logout())}
            >
              <LogOut />
              <span>Sign out</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
