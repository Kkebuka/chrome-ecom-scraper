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

    return row
  }

  // ── Batch Extraction ──────────────────────────────────────────────────────
  extractAllRows(listSelector: string, fields: FieldMapping[]): ScrapedRow[] {
    const containers = Array.from(document.querySelectorAll(listSelector))
    return containers.map(c => this.extractRow(c, fields))
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
