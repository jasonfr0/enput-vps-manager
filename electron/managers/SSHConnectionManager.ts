import { Client, ClientChannel, ConnectConfig } from 'ssh2'
import { EventEmitter } from 'events'
import { ServerConfig, SSHConnectionState } from '../types'
import log from 'electron-log'
import * as fs from 'fs'

interface ManagedConnection {
  client: Client
  state: SSHConnectionState
  config: ServerConfig
  shells: Map<string, ClientChannel>
}

export class SSHConnectionManager extends EventEmitter {
  private connections: Map<string, ManagedConnection> = new Map()
  private shellCounter = 0

  async connect(config: ServerConfig): Promise<SSHConnectionState> {
    const connId = `conn_${config.id}_${Date.now()}`

    const state: SSHConnectionState = {
      id: connId,
      serverId: config.id,
      status: 'connecting',
    }

    this.emit('stateChange', state)

    return new Promise((resolve, reject) => {
      const client = new Client()

      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
      }

      // Auth method
      if (config.authType === 'key' && config.privateKeyPath) {
        try {
          connectConfig.privateKey = fs.readFileSync(config.privateKeyPath)
          if (config.passphrase) {
            connectConfig.passphrase = config.passphrase
          }
        } catch (err) {
          state.status = 'error'
          state.error = `Failed to read private key: ${err}`
          this.emit('stateChange', state)
          reject(new Error(state.error))
          return
        }
      } else if (config.authType === 'password' && config.password) {
        connectConfig.password = config.password
      }

      client.on('ready', () => {
        log.info(`SSH connected to ${config.host}:${config.port}`)
        state.status = 'connected'

        const managed: ManagedConnection = {
          client,
          state,
          config,
          shells: new Map(),
        }

        this.connections.set(connId, managed)
        this.emit('stateChange', state)
        resolve(state)
      })

      client.on('error', (err) => {
        log.error(`SSH connection error for ${config.host}: ${err.message}`)
        state.status = 'error'
        state.error = err.message
        this.emit('stateChange', state)
        reject(err)
      })

      client.on('close', () => {
        log.info(`SSH connection closed for ${config.host}`)
        state.status = 'disconnected'
        this.connections.delete(connId)
        this.emit('stateChange', state)
      })

      client.on('end', () => {
        state.status = 'disconnected'
        this.connections.delete(connId)
        this.emit('stateChange', state)
      })

      client.connect(connectConfig)
    })
  }

  async disconnect(connId: string): Promise<void> {
    const managed = this.connections.get(connId)
    if (!managed) return

    // Close all shells
    for (const [shellId, shell] of managed.shells) {
      shell.end()
      managed.shells.delete(shellId)
    }

    managed.client.end()
    this.connections.delete(connId)
    log.info(`Disconnected ${connId}`)
  }

  async createShell(
    connId: string,
    cols: number = 80,
    rows: number = 24
  ): Promise<{ shellId: string; stream: ClientChannel }> {
    const managed = this.connections.get(connId)
    if (!managed || managed.state.status !== 'connected') {
      throw new Error(`No active connection: ${connId}`)
    }

    return new Promise((resolve, reject) => {
      managed.client.shell(
        { term: 'xterm-256color', cols, rows },
        (err, stream) => {
          if (err) {
            reject(err)
            return
          }

          const shellId = `shell_${++this.shellCounter}`
          managed.shells.set(shellId, stream)

          stream.on('close', () => {
            managed.shells.delete(shellId)
          })

          resolve({ shellId, stream })
        }
      )
    })
  }

  writeToShell(connId: string, shellId: string, data: string): void {
    const managed = this.connections.get(connId)
    if (!managed) return

    const shell = managed.shells.get(shellId)
    if (shell) {
      shell.write(data)
    }
  }

  resizeShell(
    connId: string,
    shellId: string,
    cols: number,
    rows: number
  ): void {
    const managed = this.connections.get(connId)
    if (!managed) return

    const shell = managed.shells.get(shellId)
    if (shell) {
      shell.setWindow(rows, cols, 0, 0)
    }
  }

  closeShell(connId: string, shellId: string): void {
    const managed = this.connections.get(connId)
    if (!managed) return

    const shell = managed.shells.get(shellId)
    if (shell) {
      shell.end()
      managed.shells.delete(shellId)
    }
  }

  getClient(connId: string): Client | undefined {
    return this.connections.get(connId)?.client
  }

  getState(connId: string): SSHConnectionState | undefined {
    return this.connections.get(connId)?.state
  }

  getAllConnections(): SSHConnectionState[] {
    return Array.from(this.connections.values()).map((m) => m.state)
  }

  async executeCommand(
    connId: string,
    command: string,
    timeout: number = 30000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const managed = this.connections.get(connId)
    if (!managed || managed.state.status !== 'connected') {
      throw new Error(`No active connection: ${connId}`)
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeout}ms`))
      }, timeout)

      managed.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer)
          reject(err)
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        stream.on('close', (code: number) => {
          clearTimeout(timer)
          resolve({ stdout, stderr, exitCode: code ?? 0 })
        })
      })
    })
  }

  disconnectAll(): void {
    for (const [connId] of this.connections) {
      this.disconnect(connId)
    }
  }
}
