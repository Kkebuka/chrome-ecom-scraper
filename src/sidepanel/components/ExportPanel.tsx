import { useState } from 'react'
import type { ScrapedRow, FieldMapping } from '../../shared/types'
import { useExport } from '../hooks/useExport'

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
  const [downloadImagesToggle, setDownloadImagesToggle] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [downloadCount, setDownloadCount] = useState<number | null>(null)

  const imageField = fields.find(f => f.type === 'image')
  const nameField = fields.find(f => f.type === 'name')

  const handleExport = async () => {
    setIsExporting(true)
    setDownloadCount(null)

    const columns = fields
      .filter(f => f.type !== 'image' || includeImages)
      .map(f => f.label)

    try {
      if (format === 'csv') {
        exportCSV(rows, fields, { filename, columns })
      } else {
        await exportXLSX(rows, fields, { filename, columns, embedImagesInXlsx: embedImages && !!imageField })
      }

      if (downloadImagesToggle && imageField) {
        const count = await downloadImages(
          rows,
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
          {fields.length} columns · {format.toUpperCase()} format
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
