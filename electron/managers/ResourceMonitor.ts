import { Client } from 'ssh2'
import { ResourceMetrics } from '../types'
import { EventEmitter } from 'events'
import log from 'electron-log'

export class ResourceMonitor extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  startMonitoring(
    connId: string,
    client: Client,
    intervalMs: number = 3000
  ): void {
    // Clear existing if any
    this.stopMonitoring(connId)

    const poll = async () => {
      try {
        const metrics = await this.fetchMetrics(client)
        this.emit('metrics', { connId, metrics })
      } catch (err) {
        log.error(`Resource monitor error for ${connId}:`, err)
      }
    }

    // Initial poll
    poll()

    // Set interval
    const interval = setInterval(poll, intervalMs)
    this.intervals.set(connId, interval)
    log.info(`Resource monitoring started for ${connId}`)
  }

  stopMonitoring(connId: string): void {
    const interval = this.intervals.get(connId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(connId)
      log.info(`Resource monitoring stopped for ${connId}`)
    }
  }

  stopAll(): void {
    for (const [connId] of this.intervals) {
      this.stopMonitoring(connId)
    }
  }

  private async fetchMetrics(client: Client): Promise<ResourceMetrics> {
    const command = `
      echo "---CPU---"
      top -bn1 | grep "Cpu(s)" | awk '{print $2}' 2>/dev/null || echo "0"
      echo "---MEMORY---"
      free -b | grep Mem | awk '{print $2, $3}'
      echo "---DISK---"
      df -B1 / | tail -1 | awk '{print $2, $3}'
      echo "---UPTIME---"
      cat /proc/uptime | awk '{print $1}'
      echo "---LOAD---"
      cat /proc/loadavg | awk '{print $1, $2, $3}'
    `

    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let output = ''
        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })

        stream.on('close', () => {
          try {
            const metrics = this.parseMetrics(output)
            resolve(metrics)
          } catch (parseErr) {
            reject(parseErr)
          }
        })

        stream.on('error', reject)
      })
    })
  }

  private parseMetrics(output: string): ResourceMetrics {
    const sections = output.split('---')
    const metrics: ResourceMetrics = {
      cpu: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      diskUsed: 0,
      diskTotal: 0,
      uptime: 0,
      loadAverage: [0, 0, 0],
      timestamp: Date.now(),
    }

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim()
      const nextSection = sections[i + 1]?.trim() || ''

      if (section === 'CPU') {
        metrics.cpu = parseFloat(nextSection) || 0
      } else if (section === 'MEMORY') {
        const parts = nextSection.split(/\s+/)
        metrics.memoryTotal = parseInt(parts[0]) || 0
        metrics.memoryUsed = parseInt(parts[1]) || 0
      } else if (section === 'DISK') {
        const parts = nextSection.split(/\s+/)
        metrics.diskTotal = parseInt(parts[0]) || 0
        metrics.diskUsed = parseInt(parts[1]) || 0
      } else if (section === 'UPTIME') {
        metrics.uptime = parseFloat(nextSection) || 0
      } else if (section === 'LOAD') {
        const parts = nextSection.split(/\s+/)
        metrics.loadAverage = [
          parseFloat(parts[0]) || 0,
          parseFloat(parts[1]) || 0,
          parseFloat(parts[2]) || 0,
        ]
      }
    }

    return metrics
  }
}
