import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Download, RefreshCw, Trash2, X } from 'lucide-react'
import { AuditEntry } from '../../types/api'

const CATEGORY_COLORS: Record<string, string> = {
  connection: '#6c63ff',
  terminal: '#4caf50',
  file: '#ff9800',
  claude: '#00bcd4',
}

const OUTCOME_COLORS: Record<string, string> = {
  success: '#4caf50',
  failure: '#f44336',
}

const CATEGORIES = ['connection', 'terminal', 'file', 'claude'] as const

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return iso
  }
}

export function AuditLog() {
  const [entries, setEntries]       = useState<AuditEntry[]>([])
  const [loading, setLoading]       = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSearch, setFilterSearch]     = useState('')
  const [filterSince, setFilterSince]       = useState('')
  const [filterUntil, setFilterUntil]       = useState('')
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (search?: string) => {
    setLoading(true)
    try {
      const filter: any = {}
      if (filterCategory) filter.category = filterCategory
      if (search !== undefined ? search : filterSearch) filter.search = search !== undefined ? search : filterSearch
      if (filterSince) filter.since = new Date(filterSince).toISOString()
      if (filterUntil) {
        const d = new Date(filterUntil)
        d.setHours(23, 59, 59, 999)
        filter.until = d.toISOString()
      }
      filter.limit = 500
      const data = await window.api.audit.getEntries(filter)
      setEntries(data)
    } catch (err: any) {
      console.error('[AuditLog] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterSearch, filterSince, filterUntil])

  // Initial load + reload when filter controls change (except search which is debounced)
  useEffect(() => {
    load()
  }, [filterCategory, filterSince, filterUntil])

  const handleSearchChange = (v: string) => {
    setFilterSearch(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load(v), 300)
  }

  const handleRefresh = () => load()

  const handleExportCsv = async () => {
    try {
      const csv = await window.api.audit.exportCsv()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('[AuditLog] export error:', err)
    }
  }

  const handleClear = async () => {
    try {
      await window.api.audit.clear()
      setEntries([])
      setConfirmClear(false)
    } catch (err: any) {
      console.error('[AuditLog] clear error:', err)
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.title}>Audit Log</span>
          <span style={styles.count}>{entries.length} entries</span>
        </div>
        <div style={styles.toolbarRight}>
          <button style={styles.btn} onClick={handleRefresh} title="Refresh">
            <RefreshCw size={13} style={styles.btnIcon} />
            Refresh
          </button>
          <button style={styles.btn} onClick={handleExportCsv} title="Export CSV">
            <Download size={13} style={styles.btnIcon} />
            Export CSV
          </button>
          {!confirmClear ? (
            <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={() => setConfirmClear(true)}>
              <Trash2 size={13} style={styles.btnIcon} />
              Clear All
            </button>
          ) : (
            <span style={styles.confirmRow}>
              <span style={styles.confirmText}>Erase all logs?</span>
              <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={handleClear}>Yes, clear</button>
              <button style={styles.btn} onClick={() => setConfirmClear(false)}>Cancel</button>
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          style={styles.input}
          placeholder="Search commands, actions, servers…"
          value={filterSearch}
          onChange={e => handleSearchChange(e.target.value)}
        />
        <select
          style={styles.select}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <div style={styles.dateGroup}>
          <label style={styles.dateLabel}>From</label>
          <input
            type="date"
            style={styles.dateInput}
            value={filterSince}
            onChange={e => setFilterSince(e.target.value)}
          />
        </div>
        <div style={styles.dateGroup}>
          <label style={styles.dateLabel}>To</label>
          <input
            type="date"
            style={styles.dateInput}
            value={filterUntil}
            onChange={e => setFilterUntil(e.target.value)}
          />
        </div>
        {(filterSearch || filterCategory || filterSince || filterUntil) && (
          <button
            style={styles.clearFilters}
            onClick={() => {
              setFilterSearch('')
              setFilterCategory('')
              setFilterSince('')
              setFilterUntil('')
              load('')
            }}
          >
            <X size={12} style={styles.btnIcon} />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={styles.empty}>No audit entries found.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={{ ...styles.th, width: '140px' }}>Time</th>
                <th style={{ ...styles.th, width: '100px' }}>Category</th>
                <th style={{ ...styles.th, width: '90px' }}>Action</th>
                <th style={{ ...styles.th, width: '130px' }}>Server</th>
                <th style={{ ...styles.th, width: '70px' }}>Outcome</th>
                <th style={styles.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const isExpanded = expanded.has(entry.id)
                const longDetails = entry.details.length > 80
                return (
                  <tr
                    key={entry.id}
                    style={styles.tr}
                    onClick={() => longDetails && toggleExpand(entry.id)}
                  >
                    <td style={{ ...styles.td, ...styles.mono, color: 'var(--text-muted)', fontSize: '11px' }}>
                      {formatTs(entry.timestamp)}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: (CATEGORY_COLORS[entry.category] ?? '#888') + '22',
                        color: CATEGORY_COLORS[entry.category] ?? '#888',
                        borderColor: (CATEGORY_COLORS[entry.category] ?? '#888') + '55',
                      }}>
                        {entry.category}
                      </span>
                    </td>
                    <td style={{ ...styles.td, ...styles.mono, fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {entry.action}
                    </td>
                    <td style={{ ...styles.td, ...styles.mono, fontSize: '11px', color: 'var(--text-muted)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.serverLabel}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: (OUTCOME_COLORS[entry.outcome] ?? '#888') + '22',
                        color: OUTCOME_COLORS[entry.outcome] ?? '#888',
                        borderColor: (OUTCOME_COLORS[entry.outcome] ?? '#888') + '55',
                      }}>
                        {entry.outcome}
                      </span>
                    </td>
                    <td style={{ ...styles.td, maxWidth: '0', width: '100%' }}>
                      <span
                        style={{
                          ...styles.mono,
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          display: 'block',
                          whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                          overflow: isExpanded ? 'visible' : 'hidden',
                          textOverflow: isExpanded ? 'clip' : 'ellipsis',
                          cursor: longDetails ? 'pointer' : 'default',
                          wordBreak: 'break-all',
                        }}
                        title={longDetails && !isExpanded ? entry.details : undefined}
                      >
                        {entry.details}
                        {longDetails && !isExpanded && (
                          <span style={{ color: 'var(--accent)', marginLeft: '4px' }}>…</span>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  count: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  btnIcon: {
    flexShrink: 0,
  },
  btnDanger: {
    borderColor: 'rgba(244,67,54,0.4)',
    color: '#f44336',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  confirmText: {
    fontSize: '12px',
    color: '#f44336',
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  input: {
    flex: '1 1 200px',
    minWidth: '160px',
    padding: '5px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    outline: 'none',
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
  dateGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  dateLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  dateInput: {
    padding: '4px 6px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    outline: 'none',
    colorScheme: 'dark',
  },
  clearFilters: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  tableWrap: {
    flex: 1,
    overflow: 'auto',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: 'var(--text-muted)',
    fontSize: '14px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  thead: {
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-secondary)',
    zIndex: 1,
  },
  th: {
    padding: '8px 12px',
    textAlign: 'left' as const,
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap' as const,
  },
  tr: {
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.1s',
  },
  td: {
    padding: '7px 12px',
    verticalAlign: 'top' as const,
  },
  mono: {
    fontFamily: 'var(--font-mono)',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    border: '1px solid',
    whiteSpace: 'nowrap' as const,
  },
}
