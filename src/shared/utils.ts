import { JITTER_FACTOR } from './constants'

// ─── Delay ────────────────────────────────────────────────────────────────────
/**
 * Polite delay with optional ±20% jitter to mimic human behaviour.
 */
export function delay(ms: number, jitter = true): Promise<void> {
  const wait = jitter
    ? ms + (Math.random() - 0.5) * ms * JITTER_FACTOR
    : ms
  return new Promise(resolve => setTimeout(resolve, Math.max(wait, 100)))
}

// ─── URL Helpers ──────────────────────────────────────────────────────────────
/**
 * Convert a relative URL to an absolute URL using the current page origin.
 */
export function toAbsoluteUrl(url: string, base: string = location.href): string {
  if (!url) return ''
  try {
    return new URL(url, base).href
  } catch {
    return url
  }
}

/**
 * Extract the URL from a CSS background-image property value.
 * e.g. 'url("https://example.com/img.jpg")' → 'https://example.com/img.jpg'
 */
export function extractBackgroundImageUrl(el: Element): string {
  const style = window.getComputedStyle(el)
  const bg = style.backgroundImage
  if (!bg || bg === 'none') return ''
  const match = bg.match(/url\(["']?(.+?)["']?\)/)
  return match ? toAbsoluteUrl(match[1]) : ''
}

/**
 * Extract an image URL from an element, checking multiple attributes in order:
 * src → data-src → data-lazy → data-original → background-image CSS
 */
export function extractImageUrl(el: Element): string {
  const img = el instanceof HTMLImageElement ? el : el.querySelector('img')
  if (img) {
    return (
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy') ||
      img.getAttribute('data-original') ||
      ''
    )
  }
  // Fall back to CSS background-image
  return extractBackgroundImageUrl(el)
}

// ─── CSS Selector Utilities ───────────────────────────────────────────────────
/**
 * Generate a CSS selector for a child element relative to its container.
 */
export function getRelativeSelector(root: Element, child: Element): string {
  if (root === child) return 'self'

  const parts: string[] = []
  let current: Element | null = child

  while (current && current !== root) {
    let selector = current.tagName.toLowerCase()
    if (current.id) {
      selector += `#${current.id}`
    } else if (current.className) {
      const classes = Array.from(current.classList)
        .filter(c => !c.startsWith('__ecomscraper'))  // exclude our own injected classes
        .join('.')
      if (classes) selector += `.${classes}`
    }

    // Add :nth-child if needed to disambiguate
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        s => s.tagName === current!.tagName
      )
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1
        selector += `:nth-of-type(${idx})`
      }
    }

    parts.unshift(selector)
    current = current.parentElement
  }

  return parts.join(' > ') || child.tagName.toLowerCase()
}

// ─── Domain ───────────────────────────────────────────────────────────────────
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ─── Text Formatting ──────────────────────────────────────────────────────────
export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function parsePrice(text: string): number | null {
  const match = text.match(/[\d,]+\.?\d*/)
  if (!match) return null
  return parseFloat(match[0].replace(/,/g, ''))
}

// ─── ID Generation ───────────────────────────────────────────────────────────
export function generateId(): string {
  return crypto.randomUUID()
}

// ─── Chrome Storage Helpers ───────────────────────────────────────────────────
export async function storageGet<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key)
  return result[key] as T | undefined
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

// ─── Message Helpers ──────────────────────────────────────────────────────────
export function sendToContentScript<T>(tabId: number, type: string, payload?: T): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, { type, payload })
}
