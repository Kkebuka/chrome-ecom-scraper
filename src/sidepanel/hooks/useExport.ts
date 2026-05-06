import { useCallback } from 'react'
import ExcelJS from 'exceljs'
import type { ScrapedRow, FieldMapping, ExportOptions } from '../../shared/types'

// ── Image Cell Constants ───────────────────────────────────────────────────────
// These control the visual size of embedded product photos in Excel.
// THUMB_PX must match the thumbSize sent to the content script.
const THUMB_PX = 160       // thumbnail pixel size (width & height cap)
const CELL_HEIGHT_PT = 120 // Excel row height in points  (1pt ≈ 1.33px → 120pt ≈ 160px)
const CELL_WIDTH_CH = 22   // Excel column width in characters (1ch ≈ 7px → 22ch ≈ 154px)
const BATCH_SIZE = 8       // images fetched in parallel per batch

/**
 * useExport — handles CSV, XLSX (with embedded images using exceljs), and bulk image download.
 */
export function useExport() {

  // ── CSV Export ────────────────────────────────────────────────────────────
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

  // ── XLSX Export (ExcelJS) ─────────────────────────────────────────────────
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

    // ── Define columns ──
    const imageField = fields.find(f => f.type === 'image')
    const imgColLabel = imageField?.label

    worksheet.columns = columns.map(col => ({
      header: col,
      key: col,
      width: col === imgColLabel ? CELL_WIDTH_CH : Math.max(col.length + 5, 18),
    }))

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.height = 22
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 11 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      cell.font = { bold: true, color: { argb: 'FFF1F5F9' }, size: 11 }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    // ── Add data rows ──
    rows.forEach((row, i) => {
      const rowData: Record<string, unknown> = {}
      columns.forEach(col => {
        // Clear the image cell text — image will be placed on top
        if (col === imgColLabel) {
          rowData[col] = ''
        } else {
          rowData[col] = row[col] ?? ''
        }
      })
      const excelRow = worksheet.addRow(rowData)

      // Row height: image rows are taller
      excelRow.height = imgColLabel ? CELL_HEIGHT_PT : 20

      // Vertical align middle for all content rows
      excelRow.eachCell(cell => {
        cell.alignment = { vertical: 'middle', wrapText: true }
        // Zebra striping
        if (i % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }
      })
    })

    // Auto-fit non-image columns
    worksheet.columns.forEach((column) => {
      if (column.key === imgColLabel) return // image column stays fixed
      let maxLen = 10
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const txt = cell.value ? cell.value.toString() : ''
        if (txt.length > maxLen) maxLen = txt.length
      })
      column.width = Math.min(Math.max(maxLen + 2, 12), 55)
    })

    // ── Embed images in parallel batches ──
    if (embedImages && imageField) {
      await embedImagesInExcelJSWorksheet(workbook, worksheet, rows, imageField.label, columns)
    }

    // ── Write & download ──
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    chrome.downloads.download({ url, filename: `${filename}.xlsx` })
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [])

  // ── Bulk Image Download ───────────────────────────────────────────────────
  const downloadImages = useCallback(async (
    rows: ScrapedRow[],
    imageColumn: string,
    nameColumn: string,
    folderName = 'ecomscraper-images'
  ) => {
    const items = rows
      .map((row, i) => ({
        url: String(row[imageColumn] ?? ''),
        name: String(row[nameColumn] ?? `product-${i + 1}`)
          .replace(/[^a-z0-9\s-]/gi, '')
          .replace(/\s+/g, '-')
          .toLowerCase()
          .slice(0, 60),
      }))
      .filter(item => item.url.startsWith('http'))

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

// ── Internal: Fetch one image thumbnail via content script ────────────────────
async function fetchImageBase64(
  tabId: number,
  imgUrl: string
): Promise<{ base64: string | null; width: number; height: number }> {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, {
      type: 'FETCH_IMAGE_BASE64',
      payload: { url: imgUrl, thumbSize: THUMB_PX },
    }) as { payload: { base64: string | null; mimeType: string; width?: number; height?: number } }
    const p = resp?.payload ?? {}
    return {
      base64: p.base64 ?? null,
      width:  p.width  ?? THUMB_PX,
      height: p.height ?? THUMB_PX,
    }
  } catch {
    return { base64: null, width: THUMB_PX, height: THUMB_PX }
  }
}

// ── Internal: Embed Image Thumbnails using ExcelJS ────────────────────────────
async function embedImagesInExcelJSWorksheet(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  rows: ScrapedRow[],
  imageColumn: string,
  columns: string[]
) {
  const imgColIdx = columns.indexOf(imageColumn) // 0-based
  if (imgColIdx < 0) return

  // Fix image column width to ensure images are visible
  worksheet.getColumn(imgColIdx + 1).width = CELL_WIDTH_CH

  // Get the active tab to send messages to the content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  const tabId = tab.id

  // ── Collect all image URLs first ──
  const imageItems = rows.map((row, i) => ({
    rowIndex: i,                             // 0-based data row index
    excelRow: i + 2,                         // 1-based + 1 for header
    url: String(row[imageColumn] ?? ''),
  })).filter(item => item.url.startsWith('http'))

  // ── Fetch in parallel batches (BATCH_SIZE at a time) ──
  for (let b = 0; b < imageItems.length; b += BATCH_SIZE) {
    const batch = imageItems.slice(b, b + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(item => fetchImageBase64(tabId, item.url).then(r => ({ ...item, ...r })))
    )

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { excelRow, url, base64, width, height } = result.value

      // Clear the URL text from the cell — image goes on top
      const cell = worksheet.getCell(excelRow, imgColIdx + 1)
      cell.value = ''

      if (!base64) {
        // Fallback: show a clickable hyperlink if image couldn't be fetched
        cell.value = { text: '🔗 View Image', hyperlink: url }
        cell.font = { color: { argb: 'FF3B82F6' }, underline: true }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        continue
      }

      const imageId = workbook.addImage({ base64, extension: 'jpeg' })

      // Use ext-based positioning (pixel width × height) rather than tl/br fractions.
      // This is the most reliable approach in ExcelJS for exact pixel dimensions.
      // tl col/row are 0-indexed fractional positions:
      //   - col: imgColIdx + 0.05  → 5% padding from left edge
      //   - row: excelRow - 1 + 0.05 → 5% padding from top of the row
      // ext sets the rendered pixel size of the image
      const paddingFrac = 0.06
      const scaledW = width  // already thumbnail-sized from canvas
      const scaledH = height

      worksheet.addImage(imageId, {
        tl: { col: imgColIdx + paddingFrac, row: excelRow - 1 + paddingFrac },
        ext: { width: scaledW, height: scaledH },
        editAs: 'oneCell',
      })
    }

    // Tiny pause between batches to avoid overwhelming the tab
    await new Promise(r => setTimeout(r, 40))
  }
}
