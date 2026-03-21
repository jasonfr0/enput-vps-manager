import React, { useEffect } from 'react'
import { useMonitorStore } from '../../context/useMonitorStore'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface ResourceMonitorProps {
  connId: string
}

export function ResourceMonitor({ connId }: ResourceMonitorProps) {
  const { metrics, latestMetrics, addMetrics, clearMetrics } =
    useMonitorStore()

  useEffect(() => {
    clearMetrics()

    // Start monitoring
    window.api.monitor.start(connId)

    // Listen for updates
    const unsub = window.api.monitor.onUpdate(({ metrics: newMetrics }) => {
      addMetrics(newMetrics)
    })

    return () => {
      unsub()
      window.api.monitor.stop(connId)
    }
  }, [connId])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const chartData = metrics.map((m, i) => ({
    index: i,
    cpu: m.cpu,
    memory: m.memoryTotal > 0 ? (m.memoryUsed / m.memoryTotal) * 100 : 0,
    disk: m.diskTotal > 0 ? (m.diskUsed / m.diskTotal) * 100 : 0,
    time: new Date(m.timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }))

  const memPercent = latestMetrics
    ? latestMetrics.memoryTotal > 0
      ? ((latestMetrics.memoryUsed / latestMetrics.memoryTotal) * 100).toFixed(1)
      : '0'
    : '0'

  const diskPercent = latestMetrics
    ? latestMetrics.diskTotal > 0
      ? ((latestMetrics.diskUsed / latestMetrics.diskTotal) * 100).toFixed(1)
      : '0'
    : '0'

  return (
    <div style={styles.container}>
      {/* Stats cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>CPU Usage</div>
          <div style={styles.statValue}>
            {latestMetrics?.cpu.toFixed(1) || '0'}%
          </div>
          <div style={styles.statBar}>
            <div
              style={{
                ...styles.statBarFill,
                width: `${latestMetrics?.cpu || 0}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Memory</div>
          <div style={styles.statValue}>{memPercent}%</div>
          <div style={styles.statDetail}>
            {latestMetrics
              ? `${formatBytes(latestMetrics.memoryUsed)} / ${formatBytes(
                  latestMetrics.memoryTotal
                )}`
              : '-'}
          </div>
          <div style={styles.statBar}>
            <div
              style={{
                ...styles.statBarFill,
                width: `${memPercent}%`,
                background: 'var(--success)',
              }}
            />
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Disk</div>
          <div style={styles.statValue}>{diskPercent}%</div>
          <div style={styles.statDetail}>
            {latestMetrics
              ? `${formatBytes(latestMetrics.diskUsed)} / ${formatBytes(
                  latestMetrics.diskTotal
                )}`
              : '-'}
          </div>
          <div style={styles.statBar}>
            <div
              style={{
                ...styles.statBarFill,
                width: `${diskPercent}%`,
                background: 'var(--warning)',
              }}
            />
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Uptime</div>
          <div style={styles.statValue}>
            {latestMetrics ? formatUptime(latestMetrics.uptime) : '-'}
          </div>
          <div style={styles.statDetail}>
            Load:{' '}
            {latestMetrics
              ? latestMetrics.loadAverage.map((l) => l.toFixed(2)).join(', ')
              : '-'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>CPU Usage (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333458" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b6c80' }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#6b6c80' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#222340',
                  border: '1px solid #333458',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#6c63ff"
                fill="url(#cpuGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Memory Usage (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4caf50" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4caf50" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333458" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b6c80' }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#6b6c80' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#222340',
                  border: '1px solid #333458',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="memory"
                stroke="#4caf50"
                fill="url(#memGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    overflow: 'auto',
    padding: '16px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  statCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '14px',
  },
  statLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  statDetail: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    marginTop: '4px',
  },
  statBar: {
    height: '4px',
    background: 'var(--bg-tertiary)',
    borderRadius: '2px',
    marginTop: '10px',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  chartCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '14px',
  },
  chartTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
}
