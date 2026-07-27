import { useCallback } from 'react'
import ExcelJS from 'exceljs'
import type { ScrapedRow, FieldMapping, ExportOptions } from '../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const THUMB_PX = 120       // thumbnail pixel size (reduced from 160 for faster encoding)
const CELL_HEIGHT_PT = 100 // Excel row height in points
const CELL_WIDTH_CH = 18   // Excel column width in characters
const BATCH_SIZE = 20      // images fetched in parallel per batch (increased from 8)

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImageResult {
  base64: string | null
  width: number
  height: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalizes an image URL handling protocol-relative and site-relative paths. */
function normalizeImageUrl(url: string, pageOrigin?: string): string {
  if (!url) return ''
  let cleaned = url.trim()
  if (cleaned.startsWith('//')) {
    cleaned = `https:${cleaned}`
  } else if (cleaned.startsWith('/') && pageOrigin) {
    try {
      cleaned = new URL(cleaned, pageOrigin).href
    } catch {
      // Keep cleaned as is
    }
  }
  return cleaned
}

/** In-memory cache to avoid re-fetching the same image URL. */
const imageCache = new Map<string, ImageResult>()

/**
 * Fetch and convert an image URL to a resized JPEG base64 string.
 * Uses createImageBitmap for fast off-thread decoding (no HTMLImageElement needed).
 * Results are cached so duplicate URLs across rows are instant.
 */
async function fetchImageBase64(
  imgUrl: string,
  thumbSize = THUMB_PX
): Promise<ImageResult> {
  const normalizedUrl = normalizeImageUrl(imgUrl)
  if (!normalizedUrl || (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://'))) {
    return { base64: null, width: thumbSize, height: thumbSize }
  }

  // Return cached result if available
  const cached = imageCache.get(normalizedUrl)
  if (cached) return cached

  try {
    const resp = await fetch(normalizedUrl)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const blob = await resp.blob()
    const imgBitmap = await createImageBitmap(blob)

    const srcW = imgBitmap.width || thumbSize
    const srcH = imgBitmap.height || thumbSize
    const scale = Math.min(thumbSize / srcW, thumbSize / srcH, 1)
    const dstW = Math.max(1, Math.round(srcW * scale))
    const dstH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = dstW
    canvas.height = dstH
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      imgBitmap.close()
      const result: ImageResult = { base64: null, width: thumbSize, height: thumbSize }
      imageCache.set(normalizedUrl, result)
      return result
    }

    ctx.drawImage(imgBitmap, 0, 0, dstW, dstH)
    imgBitmap.close()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75) // Lower quality = faster + smaller
    const base64 = dataUrl.split(',')[1] ?? null
    const result: ImageResult = { base64, width: dstW, height: dstH }
    imageCache.set(normalizedUrl, result)
    return result
  } catch {
    const result: ImageResult = { base64: null, width: thumbSize, height: thumbSize }
    imageCache.set(normalizedUrl, result)
    return result
  }
}

/**
 * Embeds image thumbnails into ExcelJS Worksheet.
 * Uses large parallel batches and caching for speed.
 */
async function embedImagesInWorksheet(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  rows: ScrapedRow[],
  imageColumn: string,
  columns: string[],
  pageOrigin?: string
) {
  const imgColIdx = columns.indexOf(imageColumn) // 0-based
  if (imgColIdx < 0) return

  worksheet.getColumn(imgColIdx + 1).width = CELL_WIDTH_CH

  const imageItems = rows.map((row, i) => ({
    rowIndex: i,
    excelRow: i + 2,
    url: normalizeImageUrl(String(row[imageColumn] ?? ''), pageOrigin),
  })).filter(item => item.url.startsWith('http://') || item.url.startsWith('https://'))

  // Process in large parallel batches
  for (let b = 0; b < imageItems.length; b += BATCH_SIZE) {
    const batch = imageItems.slice(b, b + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const r = await fetchImageBase64(item.url, THUMB_PX)
        return { ...item, ...r }
      })
    )

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { excelRow, url, base64, width, height } = result.value

      const cell = worksheet.getCell(excelRow, imgColIdx + 1)
      cell.value = ''

      if (!base64) {
        cell.value = { text: '🔗 View', hyperlink: url }
        cell.font = { color: { argb: 'FF3B82F6' }, underline: true, size: 9 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        continue
      }

      const imageId = workbook.addImage({ base64, extension: 'jpeg' })
      worksheet.addImage(imageId, {
        tl: { col: imgColIdx + 0.05, row: excelRow - 1 + 0.05 },
        ext: { width, height },
        editAs: 'oneCell',
      })
    }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExport() {

  // ── CSV Export ──
  const exportCSV = useCallback((
    rows: ScrapedRow[],
    fields: FieldMapping[],
    options: Partial<ExportOptions> = {}
  ) => {
    const columns = options.columns ?? fields.map(f => f.label)
    const filename = options.filename ?? 'ecomscraper-export'

    const header = columns.join(',')
    const body = rows.map(row =>
      columns.map(col => {
        const val = row[col] ?? ''
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(',')
    ).join('\n')

    const csv = `${header}\n${body}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    chrome.downloads.download({ url, filename: `${filename}.csv` })
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [])

  // ── XLSX Export (ExcelJS) ──
  const exportXLSX = useCallback(async (
    rows: ScrapedRow[],
    fields: FieldMapping[],
    options: Partial<ExportOptions> = {}
  ) => {
    const columns = options.columns ?? fields.map(f => f.label)
    const filename = options.filename ?? 'ecomscraper-export'
    const embedImages = options.embedImagesInXlsx ?? true

    const imageField = fields.find(f => f.type === 'image')
    const imgColLabel = imageField?.label

    // Get page origin for URL normalization
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const pageOrigin = tab?.url ? new URL(tab.url).origin : undefined

    // Start image pre-fetching immediately (don't wait for workbook setup)
    let imagePrefetchPromise: Promise<void> | null = null
    if (embedImages && imgColLabel) {
      const urls = [...new Set(
        rows
          .map(r => normalizeImageUrl(String(r[imgColLabel] ?? ''), pageOrigin))
          .filter(u => u.startsWith('http://') || u.startsWith('https://'))
      )]
      // Pre-warm the cache in parallel while we build the workbook
      imagePrefetchPromise = (async () => {
        for (let b = 0; b < urls.length; b += BATCH_SIZE) {
          const batch = urls.slice(b, b + BATCH_SIZE)
          await Promise.allSettled(batch.map(u => fetchImageBase64(u, THUMB_PX)))
        }
      })()
    }

    // Build workbook structure while images are downloading
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Products')

    worksheet.columns = columns.map(col => ({
      header: col,
      key: col,
      width: col === imgColLabel ? CELL_WIDTH_CH : Math.max(col.length + 4, 16),
    }))

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.height = 22
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 11, color: { argb: 'FFF1F5F9' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    // Populate data rows
    rows.forEach((row, i) => {
      const rowData: Record<string, unknown> = {}
      columns.forEach(col => {
        rowData[col] = col === imgColLabel ? '' : (row[col] ?? '')
      })
      const excelRow = worksheet.addRow(rowData)
      excelRow.height = imgColLabel ? CELL_HEIGHT_PT : 20

      excelRow.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', wrapText: true }
        if (i % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }

        // Format Naira cost columns as numeric currency
        const colHeader = columns[colNumber - 1]
        if (colHeader && /Naira|Carton Cost|Cost per Piece/i.test(colHeader)) {
          const numVal = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value).replace(/[^0-9.]/g, ''))
          if (!isNaN(numVal)) {
            cell.value = numVal
            cell.numFmt = '"₦"#,##0.00'
            cell.alignment = { vertical: 'middle', horizontal: 'right' }
          }
        }
      })
    })

    // Auto-fit column widths (skip image column)
    worksheet.columns.forEach((column) => {
      if (column.key === imgColLabel) return
      let maxLen = 10
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const txt = cell.value ? cell.value.toString() : ''
        if (txt.length > maxLen) maxLen = txt.length
      })
      column.width = Math.min(Math.max(maxLen + 2, 12), 55)
    })

    // Wait for image pre-fetch to complete, then embed
    if (imagePrefetchPromise) {
      await imagePrefetchPromise
    }
    if (embedImages && imageField) {
      await embedImagesInWorksheet(workbook, worksheet, rows, imageField.label, columns, pageOrigin)
    }

    // Write buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    chrome.downloads.download({ url, filename: `${filename}.xlsx` })
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [])

  // ── Bulk Image Download ──
  const downloadImages = useCallback(async (
    rows: ScrapedRow[],
    imageColumn: string,
    nameColumn: string,
    folderName = 'ecomscraper-images'
  ) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const pageOrigin = tab?.url ? new URL(tab.url).origin : undefined

    const items = rows
      .map((row, i) => ({
        url: normalizeImageUrl(String(row[imageColumn] ?? ''), pageOrigin),
        name: String(row[nameColumn] ?? `product-${i + 1}`)
          .replace(/[^a-z0-9\s-]/gi, '')
          .replace(/\s+/g, '-')
          .toLowerCase()
          .slice(0, 60),
      }))
      .filter(item => item.url.startsWith('http://') || item.url.startsWith('https://'))

    // Download images in parallel batches instead of one-by-one
    for (let b = 0; b < items.length; b += BATCH_SIZE) {
      const batch = items.slice(b, b + BATCH_SIZE)
      await Promise.allSettled(
        batch.map(item =>
          chrome.downloads.download({
            url: item.url,
            filename: `${folderName}/${item.name}.jpg`,
          })
        )
      )
    }

    return items.length
  }, [])

  return { exportCSV, exportXLSX, downloadImages }
}
