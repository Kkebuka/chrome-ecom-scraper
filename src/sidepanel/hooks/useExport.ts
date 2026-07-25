import { useCallback } from 'react'
import ExcelJS from 'exceljs'
import type { ScrapedRow, FieldMapping, ExportOptions } from '../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const THUMB_PX = 160       // thumbnail pixel size (width & height cap)
const CELL_HEIGHT_PT = 120 // Excel row height in points (1pt ≈ 1.33px → 120pt ≈ 160px)
const CELL_WIDTH_CH = 22   // Excel column width in characters (1ch ≈ 7px → 22ch ≈ 154px)
const BATCH_SIZE = 8       // images fetched in parallel per batch

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalizes an image URL handling protocol-relative (//...) and site-relative (/...) paths.
 */
function normalizeImageUrl(url: string, pageOrigin?: string): string {
  if (!url) return ''
  let cleaned = url.trim()
  if (cleaned.startsWith('//')) {
    cleaned = `https:${cleaned}`
  } else if (cleaned.startsWith('/') && pageOrigin) {
    try {
      cleaned = new URL(cleaned, pageOrigin).href
    } catch {
      // Keep cleaned as is if URL constructor fails
    }
  }
  return cleaned
}

/**
 * Converts a Blob to a resized JPEG base64 string using an HTMLImageElement.
 */
function convertBlobViaImageElement(
  blob: Blob,
  thumbSize: number
): Promise<{ base64: string | null; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(blob)

    img.onload = () => {
      const srcW = img.naturalWidth || thumbSize
      const srcH = img.naturalHeight || thumbSize
      const scale = Math.min(thumbSize / srcW, thumbSize / srcH, 1)
      const dstW = Math.max(1, Math.round(srcW * scale))
      const dstH = Math.max(1, Math.round(srcH * scale))

      const canvas = document.createElement('canvas')
      canvas.width = dstW
      canvas.height = dstH
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(blobUrl)
        resolve({ base64: null, width: thumbSize, height: thumbSize })
        return
      }

      ctx.drawImage(img, 0, 0, dstW, dstH)
      URL.revokeObjectURL(blobUrl)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
      const base64 = dataUrl.split(',')[1] ?? null
      resolve({ base64, width: dstW, height: dstH })
    }

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      resolve({ base64: null, width: thumbSize, height: thumbSize })
    }

    img.src = blobUrl
  })
}

/**
 * Fetch and convert an image URL to a resized JPEG base64 string.
 * Strategy 1: Sidepanel direct fetch (bypasses CORS via host_permissions).
 * Strategy 2: Content script message fallback (if page DOM or cookies needed).
 */
async function fetchImageBase64(
  imgUrl: string,
  tabId?: number,
  thumbSize = THUMB_PX
): Promise<{ base64: string | null; width: number; height: number }> {
  const normalizedUrl = normalizeImageUrl(imgUrl)
  if (!normalizedUrl || (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://'))) {
    return { base64: null, width: thumbSize, height: thumbSize }
  }

  // Strategy 1: Direct fetch in sidepanel context (bypasses CORS with host_permissions)
  try {
    const resp = await fetch(normalizedUrl)
    if (resp.ok) {
      const blob = await resp.blob()
      
      try {
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

        if (ctx) {
          ctx.drawImage(imgBitmap, 0, 0, dstW, dstH)
          imgBitmap.close()
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
          const base64 = dataUrl.split(',')[1] ?? null
          if (base64) {
            return { base64, width: dstW, height: dstH }
          }
        } else {
          imgBitmap.close()
        }
      } catch {
        const res = await convertBlobViaImageElement(blob, thumbSize)
        if (res.base64) return res
      }
    }
  } catch (err) {
    console.warn('[EcomScraper] Sidepanel fetch failed, trying content script fallback:', normalizedUrl, err)
  }

  // Strategy 2: Content script fallback
  if (tabId) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, {
        type: 'FETCH_IMAGE_BASE64',
        payload: { url: normalizedUrl, thumbSize },
      }) as { payload?: { base64?: string | null; width?: number; height?: number } }
      
      const p = resp?.payload
      if (p?.base64) {
        return {
          base64: p.base64,
          width: p.width ?? thumbSize,
          height: p.height ?? thumbSize,
        }
      }
    } catch {
      // Content script fallback failed
    }
  }

  return { base64: null, width: thumbSize, height: thumbSize }
}

/**
 * Embeds image thumbnails into ExcelJS Worksheet.
 */
async function embedImagesInExcelJSWorksheet(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  rows: ScrapedRow[],
  imageColumn: string,
  columns: string[]
) {
  const imgColIdx = columns.indexOf(imageColumn) // 0-based
  if (imgColIdx < 0) return

  worksheet.getColumn(imgColIdx + 1).width = CELL_WIDTH_CH

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tab?.id
  const pageOrigin = tab?.url ? new URL(tab.url).origin : undefined

  const imageItems = rows.map((row, i) => ({
    rowIndex: i,
    excelRow: i + 2,
    url: normalizeImageUrl(String(row[imageColumn] ?? ''), pageOrigin),
  })).filter(item => item.url.startsWith('http://') || item.url.startsWith('https://'))

  for (let b = 0; b < imageItems.length; b += BATCH_SIZE) {
    const batch = imageItems.slice(b, b + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(item => fetchImageBase64(item.url, tabId, THUMB_PX).then(r => ({ ...item, ...r })))
    )

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { excelRow, url, base64, width, height } = result.value

      const cell = worksheet.getCell(excelRow, imgColIdx + 1)
      cell.value = ''

      if (!base64) {
        cell.value = { text: '🔗 View Image', hyperlink: url }
        cell.font = { color: { argb: 'FF3B82F6' }, underline: true }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        continue
      }

      const imageId = workbook.addImage({ base64, extension: 'jpeg' })

      const paddingFrac = 0.06
      const scaledW = width
      const scaledH = height

      worksheet.addImage(imageId, {
        tl: { col: imgColIdx + paddingFrac, row: excelRow - 1 + paddingFrac },
        ext: { width: scaledW, height: scaledH },
        editAs: 'oneCell',
      })
    }

    await new Promise(r => setTimeout(r, 40))
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

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Products')

    const imageField = fields.find(f => f.type === 'image')
    const imgColLabel = imageField?.label

    worksheet.columns = columns.map(col => ({
      header: col,
      key: col,
      width: col === imgColLabel ? CELL_WIDTH_CH : Math.max(col.length + 5, 18),
    }))

    const headerRow = worksheet.getRow(1)
    headerRow.height = 22
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 11, color: { argb: 'FFF1F5F9' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    rows.forEach((row, i) => {
      const rowData: Record<string, unknown> = {}
      columns.forEach(col => {
        if (col === imgColLabel) {
          rowData[col] = ''
        } else {
          rowData[col] = row[col] ?? ''
        }
      })
      const excelRow = worksheet.addRow(rowData)

      excelRow.height = imgColLabel ? CELL_HEIGHT_PT : 20

      excelRow.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', wrapText: true }
        if (i % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }

        // Format Naira cost columns as numeric currency in Excel
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

    worksheet.columns.forEach((column) => {
      if (column.key === imgColLabel) return
      let maxLen = 10
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const txt = cell.value ? cell.value.toString() : ''
        if (txt.length > maxLen) maxLen = txt.length
      })
      column.width = Math.min(Math.max(maxLen + 2, 12), 55)
    })

    if (embedImages && imageField) {
      await embedImagesInExcelJSWorksheet(workbook, worksheet, rows, imageField.label, columns)
    }

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

    for (const item of items) {
      await chrome.downloads.download({
        url: item.url,
        filename: `${folderName}/${item.name}.jpg`,
      })
      await new Promise(r => setTimeout(r, 200))
    }

    return items.length
  }, [])

  return { exportCSV, exportXLSX, downloadImages }
}
