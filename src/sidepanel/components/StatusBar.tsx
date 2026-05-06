import type { ScrapeSession } from '../../shared/types'

interface Props {
  session: ScrapeSession | null
  status: ScrapeSession['status']
  rowCount: number
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function StatusBar({ session, status, rowCount, onPause, onResume, onStop }: Props) {
  if (status === 'idle' || status === 'selecting') return null

  const page = session?.pagesScraped ?? 0
  const total = session?.totalPages ?? 1
  const progress = Math.min(100, Math.round((page / total) * 100))

  const isRunning = status === 'running'
  const isPaused  = status === 'paused'
  const isDone    = status === 'complete'
  const isError   = status === 'error'

  return (
    <div className="panel-card p-3 space-y-3">
      {/* Status line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning && <span className="pulse-dot" />}
          {isPaused  && <span className="text-amber-400 text-xs">⏸</span>}
          {isDone    && <span className="text-brand-400 text-xs">✅</span>}
          {isError   && <span className="text-red-400 text-xs">⚠️</span>}
          <span className="text-xs font-semibold" style={{ color: 'var(--panel-text)' }}>
            {isRunning && `Scraping page ${page} of ${total}…`}
            {isPaused  && `Paused on page ${page} of ${total}`}
            {isDone    && `Done! ${rowCount.toLocaleString()} products scraped`}
            {isError   && `Error on page ${page}`}
          </span>
        </div>
        <span className="badge badge-green text-xs font-mono">{rowCount.toLocaleString()} rows</span>
      </div>

      {/* Progress bar */}
      {!isDone && !isError && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Controls */}
      {(isRunning || isPaused) && (
        <div className="flex gap-2">
          {isRunning ? (
            <button id="btn-pause" className="btn-secondary flex-1 py-1.5 text-xs" onClick={onPause}>
              ⏸ Pause
            </button>
          ) : (
            <button id="btn-resume" className="btn-primary flex-1 py-1.5 text-xs" onClick={onResume}>
              ▶ Resume
            </button>
          )}
          <button id="btn-stop" className="btn-danger flex-1 py-1.5 text-xs" onClick={onStop}>
            ⏹ Stop
          </button>
        </div>
      )}

      {/* Error message */}
      {isError && session?.error && (
        <p className="text-xs p-2 rounded" style={{ background: 'rgba(244,63,94,0.1)', color: '#f87171' }}>
          {session.error}
        </p>
      )}
    </div>
  )
}
