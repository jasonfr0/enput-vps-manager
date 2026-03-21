import { Client, SFTPWrapper } from 'ssh2'
import { FileEntry, TransferProgress } from '../types'
import { EventEmitter } from 'events'
import log from 'electron-log'
import * as fs from 'fs'
import * as path from 'path'

export class SFTPManager extends EventEmitter {
  private sftpSessions: Map<string, SFTPWrapper> = new Map()

  private async getSFTP(connId: string, client: Client): Promise<SFTPWrapper> {
    const existing = this.sftpSessions.get(connId)
    if (existing) return existing

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err)
          return
        }
        this.sftpSessions.set(connId, sftp)

        sftp.on('close', () => {
          this.sftpSessions.delete(connId)
        })

        resolve(sftp)
      })
    })
  }

  async listDirectory(
    connId: string,
    client: Client,
    remotePath: string
  ): Promise<FileEntry[]> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err)
          return
        }

        const entries: FileEntry[] = list.map((item) => {
          const isDir = (item.attrs.mode & 0o40000) !== 0
          const isLink = (item.attrs.mode & 0o120000) !== 0

          return {
            name: item.filename,
            path: path.posix.join(remotePath, item.filename),
            type: isLink ? 'symlink' : isDir ? 'directory' : 'file',
            size: item.attrs.size,
            modifyTime: item.attrs.mtime * 1000,
            accessTime: item.attrs.atime * 1000,
            rights: {
              user: this.parsePermissions((item.attrs.mode >> 6) & 7),
              group: this.parsePermissions((item.attrs.mode >> 3) & 7),
              other: this.parsePermissions(item.attrs.mode & 7),
            },
            owner: item.attrs.uid,
            group: item.attrs.gid,
          }
        })

        // Sort: directories first, then alphabetical
        entries.sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1
          if (a.type !== 'directory' && b.type === 'directory') return 1
          return a.name.localeCompare(b.name)
        })

        resolve(entries)
      })
    })
  }

  async readFile(
    connId: string,
    client: Client,
    remotePath: string
  ): Promise<string> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = sftp.createReadStream(remotePath)

      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      stream.on('error', reject)
    })
  }

  async writeFile(
    connId: string,
    client: Client,
    remotePath: string,
    content: string
  ): Promise<void> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath)
      stream.on('close', () => resolve())
      stream.on('error', reject)
      stream.end(Buffer.from(content, 'utf-8'))
    })
  }

  async uploadFile(
    connId: string,
    client: Client,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const sftp = await this.getSFTP(connId, client)
    const stat = fs.statSync(localPath)
    const totalSize = stat.size

    return new Promise((resolve, reject) => {
      let transferred = 0
      const startTime = Date.now()

      const readStream = fs.createReadStream(localPath)
      const writeStream = sftp.createWriteStream(remotePath)

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        const elapsed = (Date.now() - startTime) / 1000
        const speed = transferred / elapsed

        const progress: TransferProgress = {
          filename: path.basename(localPath),
          transferred,
          total: totalSize,
          percentage: Math.round((transferred / totalSize) * 100),
          speed,
        }

        this.emit('transferProgress', { connId, progress })
      })

      writeStream.on('close', () => {
        log.info(`Upload complete: ${localPath} -> ${remotePath}`)
        resolve()
      })

      writeStream.on('error', reject)
      readStream.on('error', reject)

      readStream.pipe(writeStream)
    })
  }

  async downloadFile(
    connId: string,
    client: Client,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(err)
          return
        }

        const totalSize = stats.size
        let transferred = 0
        const startTime = Date.now()

        const readStream = sftp.createReadStream(remotePath)
        const writeStream = fs.createWriteStream(localPath)

        readStream.on('data', (chunk: Buffer) => {
          transferred += chunk.length
          const elapsed = (Date.now() - startTime) / 1000
          const speed = transferred / elapsed

          const progress: TransferProgress = {
            filename: path.basename(remotePath),
            transferred,
            total: totalSize,
            percentage: Math.round((transferred / totalSize) * 100),
            speed,
          }

          this.emit('transferProgress', { connId, progress })
        })

        writeStream.on('close', () => {
          log.info(`Download complete: ${remotePath} -> ${localPath}`)
          resolve()
        })

        writeStream.on('error', reject)
        readStream.on('error', reject)

        readStream.pipe(writeStream)
      })
    })
  }

  async deleteFile(
    connId: string,
    client: Client,
    remotePath: string
  ): Promise<void> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async deleteDirectory(
    connId: string,
    client: Client,
    remotePath: string
  ): Promise<void> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async rename(
    connId: string,
    client: Client,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async mkdir(
    connId: string,
    client: Client,
    remotePath: string
  ): Promise<void> {
    const sftp = await this.getSFTP(connId, client)

    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  closeSFTP(connId: string): void {
    const sftp = this.sftpSessions.get(connId)
    if (sftp) {
      sftp.end()
      this.sftpSessions.delete(connId)
    }
  }

  private parsePermissions(mode: number): string {
    return (
      (mode & 4 ? 'r' : '-') +
      (mode & 2 ? 'w' : '-') +
      (mode & 1 ? 'x' : '-')
    )
  }
}
