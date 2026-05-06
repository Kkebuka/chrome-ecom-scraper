import { useEffect, useRef } from 'react'
import { useScraper } from './hooks/useScraper'
import { useTemplates } from './hooks/useTemplates'
import { ModeSelector } from './components/ModeSelector'
import { FieldMapper } from './components/FieldMapper'
import { DataTable } from './components/DataTable'
import { ExportPanel } from './components/ExportPanel'
import { PaginationConfig } from './components/PaginationConfig'
import { StatusBar } from './components/StatusBar'
import { TemplateManager } from './components/TemplateManager'
import { EXTENSION_NAME, EXTENSION_VERSION } from '../shared/constants'
import type { SiteTemplate } from '../shared/types'

export default function App() {
  const scraper = useScraper()
  const {
    matchingTemplates,
    currentDomain,
    saveTemplate,
    deleteTemplate,
  } = useTemplates()

  // Detect pagination once on mount — use a ref so we don't re-run on every render
  const hasDetectedPagination = useRef(false)
  useEffect(() => {
    if (!hasDetectedPagination.current) {
      hasDetectedPagination.current = true
      scraper.detectPagination()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLoadTemplate = (template: SiteTemplate) => {
    scraper.loadTemplate(template)
  }

  const showConfigUI = scraper.status === 'idle' || scraper.status === 'selecting'

  return (
    <div className="flex flex-col h-screen max-w-full">
      {/* Header */}
      <header className="p-3 border-b flex items-center justify-between" style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🕷</span>
          <h1 className="font-semibold text-sm tracking-wide" style={{ color: 'var(--panel-text)' }}>
            {EXTENSION_NAME} <span style={{ color: 'var(--panel-text-muted)', fontWeight: 'normal' }}>v{EXTENSION_VERSION}</span>
          </h1>
        </div>
        {/* Status indicator */}
        {scraper.status === 'selecting' && (
          <span className="badge badge-amber text-xs animate-pulse">Selecting…</span>
        )}
        {scraper.status === 'running' && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--brand)' }}>
            <span className="pulse-dot" /> Scraping
          </span>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* --- Selection and Config Phase --- */}
        {showConfigUI && (
          <>
            {/* Mode Selector */}
            <div className="panel-card p-3">
              <ModeSelector mode={scraper.mode} onModeChange={scraper.setMode} />
            </div>

            {/* List Mode Action */}
            {scraper.mode === 'list' && (
              <div className="panel-card p-3 text-center space-y-3">
                <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                  Hover over a product card on the page and click to auto-detect the pattern.
                </p>
                {!scraper.isSelecting ? (
                  <button
                    id="btn-select-elements"
                    className="btn-primary w-full"
                    onClick={scraper.startSelecting}
                  >
                    ⌖ Select Elements
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: 'var(--brand)' }}>
                      🟢 Hover over any product card and click it…
                    </p>
                    <button
                      className="btn-danger w-full"
                      onClick={scraper.cancelSelecting}
                    >
                      Cancel Selection
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Templates */}
            <div className="panel-card p-3 space-y-2">
              <h2 className="section-title">Templates ({currentDomain || 'current site'})</h2>
              <TemplateManager
                templates={matchingTemplates}
                currentDomain={currentDomain}
                onLoad={handleLoadTemplate}
                onDelete={deleteTemplate}
                onSave={saveTemplate}
                currentListSelector={scraper.listSelector}
                currentFields={scraper.fields}
                currentPaginationType={scraper.paginationInfo?.type}
              />
            </div>

            {/* Detected Fields & Pagination (shown only once we have a selector) */}
            {scraper.listSelector && (
              <>
                <div className="panel-card p-3">
                  <h2 className="section-title">
                    Fields
                    {scraper.itemCount > 0 && (
                      <span className="ml-2 badge badge-green">{scraper.itemCount} items detected</span>
                    )}
                  </h2>
                  <FieldMapper fields={scraper.fields} onChange={scraper.setFields} />
                </div>

                <div className="panel-card p-3">
                  <h2 className="section-title">Pagination &amp; Limits</h2>
                  <PaginationConfig
                    paginationInfo={scraper.paginationInfo}
                    maxPages={scraper.maxPages}
                    onMaxPagesChange={scraper.setMaxPages}
                    delayMs={scraper.delayMs}
                    onDelayChange={scraper.setDelayMs}
                  />
                </div>

                <button
                  id="btn-start-scraping"
                  className="btn-primary w-full py-3 shadow-lg text-sm"
                  onClick={scraper.startScraping}
                  disabled={scraper.fields.length === 0}
                >
                  ▶ Start Scraping
                </button>
              </>
            )}
          </>
        )}

        {/* --- Active / Complete Phase --- */}
        {!showConfigUI && (
          <div className="space-y-4">
            <StatusBar
              session={scraper.session}
              status={scraper.status}
              rowCount={scraper.rows.length}
              onPause={scraper.pause}
              onResume={scraper.resume}
              onStop={scraper.stop}
            />

            {(scraper.status === 'running' ||
              scraper.status === 'paused' ||
              scraper.status === 'complete' ||
              scraper.status === 'error') && (
              <div className="panel-card p-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-title m-0">
                    Live Preview
                    <span className="ml-2 badge badge-green">{scraper.rows.length.toLocaleString()} rows</span>
                  </h2>
                  <button
                    id="btn-new-scrape"
                    className="btn-secondary text-xs px-2 py-1"
                    onClick={scraper.reset}
                  >
                    ✕ New Scrape
                  </button>
                </div>
                <DataTable rows={scraper.rows} fields={scraper.fields} />
              </div>
            )}

            {scraper.status === 'complete' && scraper.rows.length > 0 && (
              <div className="panel-card p-3">
                <h2 className="section-title">Export</h2>
                <ExportPanel rows={scraper.rows} fields={scraper.fields} />
              </div>
            )}

            {scraper.status === 'error' && scraper.error && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
                <p className="text-xs font-semibold" style={{ color: '#f87171' }}>Error</p>
                <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>{scraper.error}</p>
                <button className="btn-secondary text-xs mt-2" onClick={scraper.reset}>Try Again</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
