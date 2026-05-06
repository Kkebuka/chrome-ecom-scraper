import {
  HIGHLIGHT_OVERLAY_ID,
  HIGHLIGHT_COLOR_HOVER,
  HIGHLIGHT_COLOR_SELECTED,
  HIGHLIGHT_BORDER_COLOR,
  MIN_REPEATING_ITEMS,
} from '../shared/constants'

export interface SelectionResult {
  listSelector: string
  count: number
  element: Element
  allElements: Element[]
}

type OnSelectCallback = (result: SelectionResult) => void

/**
 * SelectorEngine — handles hover highlighting and click-to-select
 * with automatic repeating-pattern detection.
 *
 * Injects a position:fixed overlay <div> for highlighting.
 * Uses MutationObserver to survive SPA DOM updates.
 */
export class SelectorEngine {
  private enabled = false
  private overlay: HTMLDivElement | null = null
  private onSelect: OnSelectCallback | null = null
  private hovered: Element | null = null
  private selectedElements: Element[] = []

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  enable(callback: OnSelectCallback) {
    if (this.enabled) return
    this.enabled = true
    this.onSelect = callback
    this.createOverlay()
    document.addEventListener('mouseover', this.handleMouseOver, true)
    document.addEventListener('mouseout', this.handleMouseOut, true)
    document.addEventListener('click', this.handleClick, true)
    document.body.style.cursor = 'crosshair'
  }

  disable() {
    if (!this.enabled) return
    this.enabled = false
    document.removeEventListener('mouseover', this.handleMouseOver, true)
    document.removeEventListener('mouseout', this.handleMouseOut, true)
    document.removeEventListener('click', this.handleClick, true)
    document.body.style.cursor = ''
    this.clearHighlights()
    this.removeOverlay()
    this.hovered = null
    this.selectedElements = []
  }

  // ── Overlay ────────────────────────────────────────────────────────────────
  private createOverlay() {
    this.removeOverlay()
    const div = document.createElement('div')
    div.id = HIGHLIGHT_OVERLAY_ID
    div.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid ${HIGHLIGHT_BORDER_COLOR};
      background: ${HIGHLIGHT_COLOR_HOVER};
      border-radius: 4px;
      transition: all 0.1s ease;
      display: none;
    `
    document.body.appendChild(div)
    this.overlay = div
  }

  private removeOverlay() {
    document.getElementById(HIGHLIGHT_OVERLAY_ID)?.remove()
    this.overlay = null
  }

  private positionOverlay(el: Element) {
    if (!this.overlay) return
    const rect = el.getBoundingClientRect()
    this.overlay.style.display = 'block'
    this.overlay.style.top = `${rect.top}px`
    this.overlay.style.left = `${rect.left}px`
    this.overlay.style.width = `${rect.width}px`
    this.overlay.style.height = `${rect.height}px`
  }

  private hideOverlay() {
    if (this.overlay) this.overlay.style.display = 'none'
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────
  private handleMouseOver = (e: MouseEvent) => {
    const target = e.target as Element
    if (!target || target.id === HIGHLIGHT_OVERLAY_ID) return
    this.hovered = target
    this.positionOverlay(target)
  }

  private handleMouseOut = () => {
    this.hideOverlay()
  }

  private handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const target = e.target as Element
    if (!target || target.id === HIGHLIGHT_OVERLAY_ID) return

    const result = this.detectRepeatingPattern(target)
    if (!result) return

    this.selectedElements = result.allElements
    this.highlightSelected(result.allElements)
    this.onSelect?.(result)
    this.disable()
  }

  // ── Pattern Detection ──────────────────────────────────────────────────────
  /**
   * Walk up the DOM tree to find a parent with multiple identical children.
   * Returns the most relevant repeating group.
   */
  detectRepeatingPattern(element: Element): SelectionResult | null {
    let current: Element | null = element

    while (current && current !== document.body) {
      const parent = current.parentElement
      if (!parent) break

      const siblings = Array.from(parent.children)
      if (siblings.length >= MIN_REPEATING_ITEMS) {
        const targetTag = current.tagName
        const targetClass = current.className

        const matching = siblings.filter(s =>
          s.tagName === targetTag &&
          (
            s.className === targetClass ||
            this.classOverlap(s.className, targetClass) > 0.5
          )
        )

        if (matching.length >= MIN_REPEATING_ITEMS) {
          const selector = this.buildSelector(current)
          return {
            listSelector: selector,
            count: matching.length,
            element: current,
            allElements: matching,
          }
        }
      }
      current = current.parentElement
    }

    // Fallback: return the clicked element alone
    const sel = this.buildSelector(element)
    return { listSelector: sel, count: 1, element, allElements: [element] }
  }

  /** Fraction of class tokens shared between two className strings */
  private classOverlap(a: string, b: string): number {
    const setA = new Set(a.split(' ').filter(Boolean))
    const setB = new Set(b.split(' ').filter(Boolean))
    if (setA.size === 0 && setB.size === 0) return 1
    let overlap = 0
    setA.forEach(c => { if (setB.has(c)) overlap++ })
    return overlap / Math.max(setA.size, setB.size)
  }

  /** Build a robust CSS selector from an element, escaping special characters */
  private buildSelector(el: Element): string {
    // ID is strongest — but only if it's stable (not Vue reactive IDs)
    if (el.id && !el.id.match(/^\d|v-|data-/)) return `#${CSS.escape(el.id)}`

    const tag = el.tagName.toLowerCase()

    // Filter out Vue scoped attribute classes (data-v-*) and our own injected classes
    // and escape remaining class names for safe use in querySelector
    const safeClasses = Array.from(el.classList)
      .filter(c =>
        !c.startsWith('__ecomscraper') &&   // our own injected overlay classes
        !c.match(/^v-/)                      // Vue component classes (v-enter, v-leave etc)
      )
      .map(c => `.${CSS.escape(c)}`)

    if (safeClasses.length > 0) {
      // Use at most 2 classes to keep selector stable and readable
      return `${tag}${safeClasses.slice(0, 2).join('')}`
    }

    // href-based for anchor tags (mktoys.com product links pattern)
    if (tag === 'a') {
      const href = el.getAttribute('href')
      if (href) {
        // Use the first path segment as a prefix match
        const match = href.match(/^(\/[^/]+\/?)/)
        if (match) return `a[href^='${match[1]}']`
        return `a[href^='${href.slice(0, 20)}']`
      }
    }

    return tag
  }

  // ── Selected Highlights ────────────────────────────────────────────────────
  private highlightSelected(elements: Element[]) {
    this.clearHighlights()
    elements.forEach(el => {
      const div = document.createElement('div')
      div.className = '__ecomscraper_selected_highlight__'
      div.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 2147483646;
        border: 2px solid ${HIGHLIGHT_BORDER_COLOR};
        background: ${HIGHLIGHT_COLOR_SELECTED};
        border-radius: 4px;
      `
      const rect = el.getBoundingClientRect()
      div.style.top = `${rect.top + window.scrollY}px`
      div.style.left = `${rect.left + window.scrollX}px`
      div.style.width = `${rect.width}px`
      div.style.height = `${rect.height}px`
      document.body.appendChild(div)
    })
  }

  private clearHighlights() {
    document.querySelectorAll('.__ecomscraper_selected_highlight__').forEach(el => el.remove())
  }
}
