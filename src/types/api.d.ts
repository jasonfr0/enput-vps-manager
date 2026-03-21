// Type definitions for the window.api exposed by preload
export interface ElectronAPI {
  ssh: {
    connect: (serverId: string) => Promise<any>
    disconnect: (connId: string) => Promise<void>
    onStatusChange: (callback: (state: any) => void) => () => void
  }
  terminal: {
    create: (connId: string, cols: number, rows: number) => Promise<{ shellId: string }>
    write: (connId: string, shellId: string, data: string) => void
    resize: (connId: string, shellId: string, cols: number, rows: number) => void
    close: (connId: string, shellId: string) => void
    onOutput: (callback: (data: { shellId: string; data: string }) => void) => () => void
  }
  sftp: {
    listDir: (connId: string, path: string) => Promise<any[]>
    readFile: (connId: string, path: string) => Promise<string>
    writeFile: (connId: string, path: string, content: string) => Promise<void>
    upload: (connId: string, localPath: string, remotePath: string) => Promise<void>
    download: (connId: string, remotePath: string, localPath: string) => Promise<void>
    delete: (connId: string, path: string) => Promise<void>
    rename: (connId: string, oldPath: string, newPath: string) => Promise<void>
    mkdir: (connId: string, path: string) => Promise<void>
    onTransferProgress: (callback: (data: any) => void) => () => void
  }
  monitor: {
    start: (connId: string) => Promise<void>
    stop: (connId: string) => Promise<void>
    onUpdate: (callback: (data: any) => void) => () => void
  }
  claude: {
    chat: (connId: string, messages: any[]) => Promise<any>
    execute: (connId: string, command: string) => Promise<any>
    onStream: (callback: (data: any) => void) => () => void
  }
  servers: {
    list: () => Promise<any[]>
    add: (config: any) => Promise<any>
    update: (config: any) => Promise<any>
    delete: (id: string) => Promise<void>
  }
  settings: {
    get: (key: string, defaultValue: any) => Promise<any>
    set: (key: string, value: any) => Promise<void>
  }
  dialog: {
    openFile: (options?: any) => Promise<any>
    saveFile: (options?: any) => Promise<any>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
