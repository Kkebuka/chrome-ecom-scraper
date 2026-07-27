import type { FieldMapping, ScrapedRow } from '../shared/types'
import {
  extractBackgroundImageUrl,
  toAbsoluteUrl,
  cleanText,
  parsePrice,
  getRelativeSelector,
  generateId,
} from '../shared/utils'
import {
  NAME_SELECTORS,
  PRICE_SELECTORS,
} from '../shared/constants'

/**
 * Extractor — responsible for:
 * 1. Auto-detecting fields from a selected product card container
 * 2. Extracting data from a single container element given a FieldMapping[]
 * 3. Batch-extracting all matching containers on the page
 */
export class Extractor {

  // ── Auto Field Detection ──────────────────────────────────────────────────
  /**
   * Given a sample product card element, try to auto-detect field selectors.
   */
  autoDetectFields(container: Element): FieldMapping[] {
    const fields: FieldMapping[] = []

    // ── Image ──
    const img = this.findFirst(container, ['img'])
    if (img) {
      // Standard <img> tag
      fields.push({
        id: generateId(),
        label: 'Product Image',
        type: 'image',
        cssSelector: getRelativeSelector(container, img),
        attribute: 'src',
        transform: 'url-absolute',
      })
    } else {
      // Check for CSS background-image (mktoys.com pattern)
      const bgEl = this.findFirst(container, ['[style*="background-image"]'])
        ?? this.findBackgroundImageEl(container)
      if (bgEl) {
        fields.push({
          id: generateId(),
          label: 'Product Image',
          type: 'image',
          cssSelector: getRelativeSelector(container, bgEl),
          attribute: 'background-image',
          transform: 'background-image-url',
        })
      }
    }

    // ── Price ──
    const priceEl = this.findFirst(container, PRICE_SELECTORS)
    if (priceEl) {
      fields.push({
        id: generateId(),
        label: 'Price',
        type: 'price',
        cssSelector: getRelativeSelector(container, priceEl),
        attribute: 'text',
        transform: 'trim',
      })
    }

    // ── Name ──
    const nameEl = this.findFirst(container, NAME_SELECTORS, el =>
      (el.textContent?.trim().length ?? 0) > 2
    )
    if (nameEl) {
      fields.push({
        id: generateId(),
        label: 'Product Name',
        type: 'name',
        cssSelector: getRelativeSelector(container, nameEl),
        attribute: 'text',
        transform: 'trim',
      })
    }

    // ── Product URL ──
    const link = container instanceof HTMLAnchorElement
      ? container
      : container.querySelector('a[href]') as HTMLAnchorElement | null
    if (link) {
      fields.push({
        id: generateId(),
        label: 'Product URL',
        type: 'url',
        cssSelector: container instanceof HTMLAnchorElement ? 'self' : getRelativeSelector(container, link),
        attribute: 'href',
        transform: 'url-absolute',
      })
    }

    return fields
  }

  // ── Single Row Extraction ─────────────────────────────────────────────────
  extractRow(container: Element, fields: FieldMapping[]): ScrapedRow {
    const row: ScrapedRow = {}

    for (const field of fields) {
      try {
        row[field.label] = this.extractFieldValue(container, field)
      } catch {
        row[field.label] = null
      }
    }

    // Clean up CBM if it contains product title text instead of CBM number
    if (row['CBM'] && typeof row['CBM'] === 'string') {
      const cbmMatch = (row['CBM'] as string).match(/CBM(?:\(m³\))?[:\s]+([\d.]+)/i) || (row['CBM'] as string).match(/\b0\.\d+\b/)
      if (cbmMatch?.[1] || cbmMatch?.[0]) {
        row['CBM'] = cbmMatch[1] || cbmMatch[0]
      } else {
        delete row['CBM']
      }
    }

    // Clean up Outer Packing if it contains product title text instead of PCS number
    if (row['Outer Packing'] && typeof row['Outer Packing'] === 'string') {
      const pcsMatch = (row['Outer Packing'] as string).match(/(?:Outer\s*Packing|Packing|Pcs\/Carton|PCS|Qty)[:\s]+(\d+)/i)
      if (pcsMatch?.[1]) {
        row['Outer Packing'] = pcsMatch[1]
      } else if (!/MKB|\b[A-Z]{2,}\d+/i.test(row['Outer Packing'] as string) && /^\d+$/.test((row['Outer Packing'] as string).trim())) {
        row['Outer Packing'] = (row['Outer Packing'] as string).trim()
      } else {
        delete row['Outer Packing']
      }
    }

    // Fallback 1: search full container text if CBM or Outer Packing fields were not mapped or extracted
    let fullText = cleanText(container.textContent ?? '')
    if (!row['CBM']) {
      const cbmMatch = fullText.match(/CBM(?:\(m³\))?[:\s]+([\d.]+)/i)
      if (cbmMatch?.[1]) row['CBM'] = cbmMatch[1]
    }
    if (!row['Outer Packing']) {
      const pcsMatch = fullText.match(/(?:Outer\s*Packing|Packing|Pcs\/Carton|PCS|Qty)[:\s]+(\d+)/i)
      if (pcsMatch?.[1]) row['Outer Packing'] = pcsMatch[1]
    }

    // Trigger hover mouse events if CBM or Outer Packing are still missing to reveal mktoys popovers
    if (!row['CBM'] || !row['Outer Packing']) {
      try {
        container.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }))
        container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }))
        fullText = cleanText(container.textContent ?? '')
        if (!row['CBM']) {
          const cbmMatch = fullText.match(/CBM(?:\(m³\))?[:\s]+([\d.]+)/i)
          if (cbmMatch?.[1]) row['CBM'] = cbmMatch[1]
        }
        if (!row['Outer Packing']) {
          const pcsMatch = fullText.match(/(?:Outer\s*Packing|Packing|Pcs\/Carton|PCS|Qty)[:\s]+(\d+)/i)
          if (pcsMatch?.[1]) row['Outer Packing'] = pcsMatch[1]
        }
      } catch {
        // ignore
      }
    }

    // Fallback 2: search page popovers / tooltips if CBM or Outer Packing are still missing
    if (!row['CBM'] || !row['Outer Packing']) {
      const popovers = Array.from(document.querySelectorAll('.el-popper, .el-popover, .popover, [role="tooltip"]'))
      for (const pop of popovers) {
        const popText = cleanText(pop.textContent ?? '')
        if (!row['CBM']) {
          const cbmMatch = popText.match(/CBM(?:\(m³\))?[:\s]+([\d.]+)/i)
          if (cbmMatch?.[1]) row['CBM'] = cbmMatch[1]
        }
        if (!row['Outer Packing']) {
          const pcsMatch = popText.match(/(?:Outer\s*Packing|Packing|Pcs\/Carton|PCS|Qty)[:\s]+(\d+)/i)
          if (pcsMatch?.[1]) row['Outer Packing'] = pcsMatch[1]
        }
      }
    }

    return row
  }

  // ── Batch Extraction ──────────────────────────────────────────────────────
  extractAllRows(listSelector: string, fields: FieldMapping[]): ScrapedRow[] {
    const rawContainers = Array.from(document.querySelectorAll(listSelector))
    // Filter out containers that are nested inside another matched container
    const containers = rawContainers.filter(c => !rawContainers.some(parent => parent !== c && parent.contains(c)))

    const extractedRows = containers.map(c => this.extractRow(c, fields))

    // Deduplicate extracted rows by Product URL, SKU, or Product Name
    const seen = new Set<string>()
    return extractedRows.filter(row => {
      const key = String(row['Product URL'] || row['SKU / Item Code'] || row['Product Name'] || JSON.stringify(row))
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // ── Field Value Extraction ────────────────────────────────────────────────
  private extractFieldValue(container: Element, field: FieldMapping): string | number | null {
    const el = this.resolveElement(container, field.cssSelector)
    if (!el) return null

    let value: string | null = null

    switch (field.attribute) {
      case 'text':
      case undefined:
        value = cleanText(el.textContent ?? '')
        break

      case 'href':
        value = (el as HTMLAnchorElement).href ?? el.getAttribute('href') ?? ''
        break

      case 'src':
        value = (el as HTMLImageElement).src
          || el.getAttribute('src')
          || el.getAttribute('data-src')
          || el.getAttribute('data-lazy')
          || el.getAttribute('data-original')
          || ''
        break

      case 'background-image':
        value = extractBackgroundImageUrl(el)
        break

      default:
        value = el.getAttribute(field.attribute) ?? null
    }

    if (!value) return null

    // Apply transforms
    switch (field.transform) {
      case 'trim':
        return cleanText(value)
      case 'number':
        return parsePrice(value)
      case 'url-absolute':
        return toAbsoluteUrl(value)
      case 'background-image-url':
        return value  // already extracted as absolute URL
      default:
        return value
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private resolveElement(container: Element, cssSelector: string): Element | null {
    if (cssSelector === 'self') return container
    try {
      return container.querySelector(cssSelector)
    } catch {
      return null
    }
  }

  private findFirst(
    container: Element,
    selectors: string[],
    predicate?: (el: Element) => boolean
  ): Element | null {
    for (const sel of selectors) {
      try {
        const el = container.querySelector(sel)
        if (el && (!predicate || predicate(el))) return el
      } catch { /* bad selector — skip */ }
    }
    return null
  }

  private findBackgroundImageEl(container: Element): Element | null {
    const all = container.querySelectorAll('*')
    for (const el of all) {
      if (extractBackgroundImageUrl(el)) return el
    }
    return null
  }

  // Public helper for image URL extraction (used by export)
  extractImageUrlFromRow(row: ScrapedRow, imageColumn: string): string {
    const val = row[imageColumn]
    if (!val || typeof val !== 'string') return ''
    return val
  }
}
