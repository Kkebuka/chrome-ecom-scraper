import type { PaginationInfo } from '../../shared/types'
import { PAGINATION_LABELS, MIN_DELAY_MS, MAX_DELAY_MS } from '../../shared/constants'

interface Props {
  paginationInfo: PaginationInfo | null
  maxPages: number
  delayMs: number
  onMaxPagesChange: (n: number) => void
  onDelayChange: (ms: number) => void
}

export function PaginationConfig({ paginationInfo, maxPages, delayMs, onMaxPagesChange, onDelayChange }: Props) {
  const type = paginationInfo?.type ?? 'none'
  const label = PAGINATION_LABELS[type]

  return (
    <div className="space-y-3">
      {/* Detected Type */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>Detected type</span>
        <span className={`badge ${type === 'none' ? 'badge-amber' : 'badge-green'}`}>
          {label}
        </span>
      </div>

      {type !== 'none' && (
        <>
          {/* Max Pages */}
          <div>
            <label className="input-label" htmlFor="max-pages">Max Pages</label>
            <div className="flex items-center gap-2">
              <input
                id="max-pages"
                type="number"
                min={1}
                max={500}
                className="input text-xs py-1 w-20"
                value={maxPages}
                onChange={e => onMaxPagesChange(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <span className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                pages at a time
              </span>
            </div>
          </div>

          {/* Delay Slider */}
          <div>
            <label className="input-label" htmlFor="delay-slider">
              Delay Between Pages
              <span className="ml-1 font-mono normal-case" style={{ color: 'var(--brand)' }}>
                {(delayMs / 1000).toFixed(1)}s
              </span>
            </label>
            <input
              id="delay-slider"
              type="range"
              min={MIN_DELAY_MS}
              max={MAX_DELAY_MS}
              step={100}
              value={delayMs}
              onChange={e => onDelayChange(parseInt(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--brand)' }}
            />
            <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>
              <span>0.5s</span>
              <span className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>±20% jitter applied</span>
              <span>5s</span>
            </div>
          </div>
        </>
      )}

      {type === 'none' && (
        <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
          Only one page detected — pagination not needed.
        </p>
      )}
    </div>
  )
}
