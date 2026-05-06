import type { ScraperMode } from '../../shared/types'

interface Props {
  mode: ScraperMode
  onModeChange: (mode: ScraperMode) => void
}

const MODES: { id: ScraperMode; label: string; icon: string; desc: string }[] = [
  { id: 'list',      label: 'List',      icon: '⊞', desc: 'Click a product card to auto-detect all similar items' },
  { id: 'click',     label: 'Click',     icon: '⊕', desc: 'Click individual fields to define them manually' },
  { id: 'url-batch', label: 'URL Batch', icon: '⊛', desc: 'Paste a list of URLs to scrape them all' },
]

export function ModeSelector({ mode, onModeChange }: Props) {
  return (
    <div>
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--panel-bg)' }}>
        {MODES.map(m => (
          <button
            key={m.id}
            className={`mode-tab ${mode === m.id ? 'active' : ''}`}
            onClick={() => onModeChange(m.id)}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
        {MODES.find(m => m.id === mode)?.desc}
      </p>
    </div>
  )
}
