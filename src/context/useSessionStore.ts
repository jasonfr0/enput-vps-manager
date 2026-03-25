import { create } from 'zustand'
import { TeamUser, UserRole } from '../types/api'

interface SessionState {
  currentUser: TeamUser | null
  /** Whether the app has checked if any users exist yet */
  bootstrapped: boolean
  /** True if the user store is empty (first-run setup needed) */
  needsSetup: boolean

  setCurrentUser: (user: TeamUser | null) => void
  setBootstrapped: (needsSetup: boolean) => void
  logout: () => void

  /** Convenience helpers */
  isAdmin: () => boolean
  isOperator: () => boolean
  isReadOnly: () => boolean
  /** Can the current user see/use the given server? */
  canAccessServer: (serverId: string) => boolean
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentUser: null,
  bootstrapped: false,
  needsSetup: false,

  setCurrentUser: (user) => set({ currentUser: user }),
  setBootstrapped: (needsSetup) => set({ bootstrapped: true, needsSetup }),
  logout: () => set({ currentUser: null }),

  isAdmin: () => get().currentUser?.role === 'admin',
  isOperator: () => {
    const role = get().currentUser?.role
    return role === 'admin' || role === 'operator'
  },
  isReadOnly: () => get().currentUser?.role === 'readonly',

  canAccessServer: (serverId: string) => {
    const user = get().currentUser
    if (!user) return false
    if (user.serverAccess === '*') return true
    return user.serverAccess.includes(serverId)
  },
}))

/** Role display labels */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin:    'Admin',
  operator: 'Operator',
  readonly: 'Read-only',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:    'Full access: manage users, all servers, all features',
  operator: 'Connect, terminal, files, Claude — no user management',
  readonly: 'View monitor and audit log only; terminals are output-only',
}
