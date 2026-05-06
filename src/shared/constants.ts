import type { PaginationType } from './types'

// ─── Delays ───────────────────────────────────────────────────────────────────
export const DEFAULT_DELAY_MS = 1500
export const MIN_DELAY_MS = 500
export const MAX_DELAY_MS = 5000
export const JITTER_FACTOR = 0.4     // ±20% of delay
export const SPA_MUTATION_TIMEOUT_MS = 3000
export const INFINITE_SCROLL_TIMEOUT_MS = 3000
export const IMAGE_FETCH_DELAY_MS = 200

// ─── Pattern Detection ────────────────────────────────────────────────────────
export const MIN_REPEATING_ITEMS = 3    // minimum siblings to consider a repeating pattern

// ─── Selector Pools ──────────────────────────────────────────────────────────
export const PRICE_SELECTORS = [
  '[class*="price"]',
  '[class*="cost"]',
  '[class*="amount"]',
  '[class*="money"]',
  '[data-price]',
  '[itemprop="price"]',
  '.price',
  '.cost',
  '.money',
]

export const NAME_SELECTORS = [
  'h1', 'h2', 'h3', 'h4',
  '[class*="title"]',
  '[class*="name"]',
  '[class*="product-name"]',
  '[class*="item-name"]',
  '[itemprop="name"]',
  '.desc',
]

export const IMAGE_SELECTORS = [
  'img',
  '[class*="product-img"]',
  '[class*="item-img"]',
  '[class*="thumb"]',
  '[style*="background-image"]',
]

export const NEXT_BUTTON_SELECTORS = [
  'button.btn-next',                    // Element Plus (SPA)
  'a[class*="next"]:not([disabled])',
  'button[class*="next"]:not([disabled])',
  'a[aria-label="Next page"]',
  'a[aria-label="Next"]',
  'a[rel="next"]',
  '.pagination .next a',
  'li.next a',
  '[class*="pagination"] [class*="next"]',
]

export const LOAD_MORE_SELECTORS = [
  'button[class*="load-more"]',
  'a[class*="load-more"]',
  '[class*="load_more"]',
  '[class*="loadmore"]',
]

export const NUMBERED_PAGINATION_SELECTORS = [
  'ul.el-pager li.number',    // Element Plus (SPA)
  '[class*="pagination"] a',
  '.page-numbers',
  'nav.pagination',
  '[class*="page-link"]',
]

export const INFINITE_SCROLL_SENTINELS = [
  '[class*="sentinel"]',
  '[class*="infinite"]',
  '[data-infinite]',
  '[class*="load-trigger"]',
  '[class*="scroll-trigger"]',
]

// ─── Pagination Types ─────────────────────────────────────────────────────────
export const PAGINATION_LABELS: Record<PaginationType, string> = {
  'numbered':       'Numbered Pages',
  'next-button':    'Next Button',
  'infinite-scroll':'Infinite Scroll',
  'load-more':      'Load More Button',
  'spa-next':       'SPA Pagination (JS)',
  'none':           'Single Page',
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  templates: (domain: string) => `template_${domain}`,
  session: 'current_session',
  settings: 'user_settings',
} as const

// ─── Extension ────────────────────────────────────────────────────────────────
export const EXTENSION_NAME = 'EcomScraper'
export const EXTENSION_VERSION = '1.0.0'
export const HIGHLIGHT_OVERLAY_ID = '__ecomscraper_overlay__'
export const HIGHLIGHT_COLOR_HOVER = 'rgba(34, 197, 94, 0.3)'     // brand green, 30% opacity
export const HIGHLIGHT_COLOR_SELECTED = 'rgba(34, 197, 94, 0.15)' // brand green, 15% opacity
export const HIGHLIGHT_BORDER_COLOR = '#16a34a'
