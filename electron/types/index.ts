export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'key' | 'password'
  privateKeyPath?: string
  password?: string
  passphrase?: string
}

export interface SSHConnectionState {
  id: string
  serverId: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  error?: string
}

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  modifyTime: number
  accessTime: number
  rights: {
    user: string
    group: string
    other: string
  }
  owner: number
  group: number
}

export interface ResourceMetrics {
  cpu: number
  memoryUsed: number
  memoryTotal: number
  diskUsed: number
  diskTotal: number
  uptime: number
  loadAverage: number[]
  timestamp: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  commandOutput?: {
    command: string
    stdout: string
    stderr: string
    exitCode: number
  }
}

export interface TransferProgress {
  filename: string
  transferred: number
  total: number
  percentage: number
  speed: number
}

// SSH Key types (re-exported from manager for renderer use)
export interface SSHKeyInfo {
  name: string
  privatePath: string
  publicPath: string
  type: string
  comment: string
  fingerprint: string
}

export interface AuthorizedKey {
  type: string
  key: string
  comment: string
  raw: string
}

// IPC channel names
export const IPC_CHANNELS = {
  // SSH
  SSH_CONNECT: 'ssh:connect',
  SSH_DISCONNECT: 'ssh:disconnect',
  SSH_STATUS: 'ssh:status',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',

  // SFTP
  SFTP_LIST_DIR: 'sftp:listDir',
  SFTP_READ_FILE: 'sftp:readFile',
  SFTP_WRITE_FILE: 'sftp:writeFile',
  SFTP_UPLOAD: 'sftp:upload',
  SFTP_DOWNLOAD: 'sftp:download',
  SFTP_DELETE: 'sftp:delete',
  SFTP_RENAME: 'sftp:rename',
  SFTP_MKDIR: 'sftp:mkdir',
  SFTP_DELETE_DIR: 'sftp:deleteDir',
  SFTP_TRANSFER_PROGRESS: 'sftp:transferProgress',

  // Monitoring
  MONITOR_START: 'monitor:start',
  MONITOR_STOP: 'monitor:stop',
  MONITOR_UPDATE: 'monitor:update',

  // Claude
  CLAUDE_CHAT: 'claude:chat',
  CLAUDE_CHAT_STREAM: 'claude:chatStream',
  CLAUDE_EXECUTE: 'claude:execute',

  // Servers
  SERVERS_LIST: 'servers:list',
  SERVERS_ADD: 'servers:add',
  SERVERS_UPDATE: 'servers:update',
  SERVERS_DELETE: 'servers:delete',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // SSH exec (generic)
  SSH_EXEC: 'ssh:exec',

  // SSH Key Management
  SSHKEY_LIST_LOCAL:        'sshkey:listLocal',
  SSHKEY_GENERATE:          'sshkey:generate',
  SSHKEY_DELETE:            'sshkey:delete',
  SSHKEY_GET_PUBLIC:        'sshkey:getPublic',
  SSHKEY_LIST_AUTHORIZED:   'sshkey:listAuthorized',
  SSHKEY_ADD_AUTHORIZED:    'sshkey:addAuthorized',
  SSHKEY_REMOVE_AUTHORIZED: 'sshkey:removeAuthorized',

  // Auto-updater
  UPDATE_CHECK:    'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL:  'update:install',
  UPDATE_GET:      'update:get',
  UPDATE_STATUS:   'update:status',   // main → renderer push

  // Audit log
  AUDIT_GET:       'audit:get',
  AUDIT_LOG:       'audit:log',
  AUDIT_CLEAR:     'audit:clear',
  AUDIT_EXPORT_CSV:'audit:exportCsv',

  // User / team management
  USER_IS_EMPTY:        'user:isEmpty',
  USER_AUTHENTICATE:    'user:authenticate',
  USER_LIST:            'user:list',
  USER_CREATE:          'user:create',
  USER_UPDATE:          'user:update',
  USER_DELETE:          'user:delete',
  USER_CHANGE_PASSWORD: 'user:changePassword',
} as const
