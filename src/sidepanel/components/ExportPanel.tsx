import { useState, useEffect } from 'react'
import type { ScrapedRow, FieldMapping, LandedCostConfig } from '../../shared/types'
import { DEFAULT_LANDED_COST_CONFIG, STORAGE_KEYS } from '../../shared/constants'
import { storageGet, storageSet } from '../../shared/utils'
import { calculateRowLandedCost } from '../../shared/calculator'
import { useExport } from '../hooks/useExport'
import { LandedCostConfigPanel } from './LandedCostConfigPanel'

interface Props {
  rows: ScrapedRow[]
  fields: FieldMapping[]
  defaultFilename?: string
}

export function ExportPanel({ rows, fields, defaultFilename = 'ecomscraper-export' }: Props) {
  const { exportCSV, exportXLSX, downloadImages } = useExport()

  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx')
  const [filename, setFilename] = useState(defaultFilename)
  const [includeImages, setIncludeImages] = useState(true)
  const [embedImages, setEmbedImages] = useState(true)
  const [includeNairaPrice, setIncludeNairaPrice] = useState(true)
  const [showCalculatorConfig, setShowCalculatorConfig] = useState(false)
  const [landedCostConfig, setLandedCostConfig] = useState<LandedCostConfig>({ ...DEFAULT_LANDED_COST_CONFIG })
  const [downloadImagesToggle, setDownloadImagesToggle] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [downloadCount, setDownloadCount] = useState<number | null>(null)

  // Load saved landed cost config on mount
  useEffect(() => {
    storageGet<LandedCostConfig>(STORAGE_KEYS.landedCostConfig).then(saved => {
      if (saved) {
        setLandedCostConfig({ ...DEFAULT_LANDED_COST_CONFIG, ...saved })
      }
    })
  }, [])

  const handleConfigChange = (updated: LandedCostConfig) => {
    setLandedCostConfig(updated)
    storageSet(STORAGE_KEYS.landedCostConfig, updated)
  }

  const imageField = fields.find(f => f.type === 'image')
  const nameField = fields.find(f => f.type === 'name')

  const handleExport = async () => {
    setIsExporting(true)
    setDownloadCount(null)

    // Prepare rows with calculated Naira landed cost columns if toggled
    const exportRows = rows.map(row => {
      const enriched = { ...row }
      if (includeNairaPrice) {
        const res = calculateRowLandedCost(row, landedCostConfig)
        enriched['Total Carton Cost (NGN)'] = res.totalCartonCostNGN
        enriched['Naira Price (Per Piece)'] = res.costPerPieceNGN
      }
      return enriched
    })

    const baseColumns = fields
      .filter(f => f.type !== 'image' || includeImages)
      .map(f => f.label)
      .filter(col => col !== 'Naira price' && col !== 'Cost per Piece (NGN)' && col !== 'Total Carton Cost (NGN)')

    let columns = baseColumns
    if (includeNairaPrice) {
      columns = [...columns, 'Total Carton Cost (NGN)', 'Naira Price (Per Piece)']
    }

    try {
      if (format === 'csv') {
        exportCSV(exportRows, fields, { filename, columns })
      } else {
        await exportXLSX(exportRows, fields, { filename, columns, embedImagesInXlsx: embedImages && !!imageField })
      }

      if (downloadImagesToggle && imageField) {
        const count = await downloadImages(
          exportRows,
          imageField.label,
          nameField?.label ?? 'Product Name'
        )
        setDownloadCount(count)
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Format Tabs */}
      <div>
        <label className="input-label">Export Format</label>
        <div className="flex gap-2">
          {(['xlsx', 'csv'] as const).map(f => (
            <button
              key={f}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all border ${
                format === f
                  ? 'border-brand-600'
                  : 'border-transparent'
              }`}
              style={{
                background: format === f ? 'var(--brand-dim)' : 'var(--panel-surface-2)',
                color: format === f ? 'var(--brand)' : 'var(--panel-text-muted)',
                borderColor: format === f ? 'rgba(34,197,94,0.4)' : 'var(--panel-border)',
              }}
              onClick={() => setFormat(f)}
            >
              {f === 'xlsx' ? '📊 Excel / XLSX' : '📄 CSV'}
            </button>
          ))}
        </div>
        {format === 'csv' && (
          <p className="mt-1 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
            CSV will include image URLs as text. To see actual images, use Excel export.
          </p>
        )}
      </div>

      {/* Filename */}
      <div>
        <label className="input-label">Filename</label>
        <input
          id="export-filename"
          className="input"
          value={filename}
          onChange={e => setFilename(e.target.value)}
          placeholder="ecomscraper-export"
        />
      </div>

      {/* Naira Price (Landed Cost) Option */}
      <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}>
        <div className="flex items-center justify-between">
          <p className="section-title mb-0">Naira Price Calculation</p>
          <button
            type="button"
            className="text-xs underline cursor-pointer"
            style={{ color: 'var(--brand)' }}
            onClick={() => setShowCalculatorConfig(!showCalculatorConfig)}
          >
            {showCalculatorConfig ? 'Hide Settings ▲' : 'Edit Exchange & Fees ▼'}
          </button>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="toggle">
            <input
              id="toggle-include-naira-price"
              type="checkbox"
              checked={includeNairaPrice}
              onChange={e => setIncludeNairaPrice(e.target.checked)}
            />
            <div className="toggle-track" />
            <div className="toggle-thumb" />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--panel-text)' }}>Include "Naira price" column</p>
            <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
              Landed cost per piece (Rate: ₦{landedCostConfig.dollarRate.toLocaleString()}/$, Freight: ${landedCostConfig.freightUSD.toLocaleString()})
            </p>
          </div>
        </label>

        {showCalculatorConfig && (
          <div className="mt-3">
            <LandedCostConfigPanel config={landedCostConfig} onChange={handleConfigChange} />
          </div>
        )}
      </div>

      {/* Image Options */}
      {imageField && (
        <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}>
          <p className="section-title mb-2">Image Options</p>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="toggle">
              <input
                id="toggle-include-images"
                type="checkbox"
                checked={includeImages}
                onChange={e => setIncludeImages(e.target.checked)}
              />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--panel-text)' }}>Include image column</p>
              <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>Add image URLs to the export</p>
            </div>
          </label>

          {format === 'xlsx' && includeImages && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="toggle">
                <input
                  id="toggle-embed-images"
                  type="checkbox"
                  checked={embedImages}
                  onChange={e => setEmbedImages(e.target.checked)}
                />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--panel-text)' }}>Embed images in Excel cells</p>
                <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>Show actual product photos in spreadsheet</p>
              </div>
            </label>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="toggle">
              <input
                id="toggle-download-images"
                type="checkbox"
                checked={downloadImagesToggle}
                onChange={e => setDownloadImagesToggle(e.target.checked)}
              />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--panel-text)' }}>Also download image files</p>
              <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>Saves images to a folder on your computer</p>
            </div>
          </label>
        </div>
      )}

      {/* Summary */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--brand-dim)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>
          ✅ {rows.length.toLocaleString()} products ready to export
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>
          {fields.length + (includeNairaPrice ? 1 : 0)} columns · {format.toUpperCase()} format
        </p>
      </div>

      {downloadCount !== null && (
        <p className="text-xs" style={{ color: 'var(--brand)' }}>
          ✅ {downloadCount} images downloaded to your Downloads folder
        </p>
      )}

      {/* Export Button */}
      <button
        id="btn-export-now"
        className="btn-primary w-full py-3"
        onClick={handleExport}
        disabled={isExporting || rows.length === 0}
      >
        {isExporting ? (
          <><span className="pulse-dot" /> Exporting…</>
        ) : (
          `💾 Export ${rows.length.toLocaleString()} Products`
        )}
      </button>
    </div>
  )
}

