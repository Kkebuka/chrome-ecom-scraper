import { useState } from 'react'
import type { ScrapedRow, FieldMapping } from '../../shared/types'

interface Props {
  rows: ScrapedRow[]
  fields: FieldMapping[]
}

const MAX_PREVIEW = 100

export function DataTable({ rows, fields }: Props) {
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  if (fields.length === 0 || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
        No data yet
      </div>
    )
  }

  const columns = fields.map(f => f.label)
  const displayRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(Math.min(rows.length, MAX_PREVIEW) / PAGE_SIZE)

  return (
    <div>
      <div className="overflow-x-auto" style={{ maxHeight: '220px', overflowY: 'auto' }}>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="py-2 px-2 text-left" style={{ minWidth: '30px', background: 'var(--panel-surface-2)', color: 'var(--panel-text-muted)', fontSize: '11px' }}>#</th>
              {columns.map(col => (
                <th key={col} className="py-2 px-3 text-left" style={{ background: 'var(--panel-surface-2)', color: 'var(--panel-text-muted)', fontSize: '11px', minWidth: '80px' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td className="py-1 px-2 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                  {page * PAGE_SIZE + i + 1}
                </td>
                {columns.map(col => {
                  const val = row[col]
                  const isUrl = typeof val === 'string' && val.startsWith('http')
                  return (
                    <td key={col} className="py-1 px-3 text-xs" style={{ maxWidth: '120px' }}>
                      {isUrl ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline"
                          style={{ color: '#4ade80' }}
                          title={val}
                        >
                          {val.length > 30 ? `${val.slice(0, 28)}…` : val}
                        </a>
                      ) : (
                        <span title={String(val ?? '')}>
                          {val === null || val === undefined ? (
                            <span style={{ color: 'var(--panel-text-muted)', fontStyle: 'italic' }}>—</span>
                          ) : (
                            String(val).length > 30 ? `${String(val).slice(0, 28)}…` : String(val)
                          )}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
          <button
            className="btn-icon w-6 h-6 text-xs"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ‹
          </button>
          <span>{page + 1} / {totalPages} {rows.length > MAX_PREVIEW ? `(showing first ${MAX_PREVIEW})` : ''}</span>
          <button
            className="btn-icon w-6 h-6 text-xs"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
