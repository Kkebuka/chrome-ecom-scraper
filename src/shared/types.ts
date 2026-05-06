// ─── Scraper Modes ───────────────────────────────────────────────────────────
export type ScraperMode = 'list' | 'click' | 'url-batch'

// ─── Pagination ───────────────────────────────────────────────────────────────
export type PaginationType =
  | 'numbered'
  | 'next-button'
  | 'infinite-scroll'
  | 'load-more'
  | 'spa-next'      // SPA-based pagination (e.g. Vue/React, no URL change)
  | 'none'

// ─── Field Types ─────────────────────────────────────────────────────────────
export type FieldType =
  | 'name'
  | 'price'
  | 'image'
  | 'category'
  | 'sku'
  | 'description'
  | 'url'
  | 'custom'

export type AttributeType =
  | 'text'
  | 'href'
  | 'src'
  | 'background-image'   // CSS computed background-image (for mktoys.com etc.)
  | 'data-src'           // Lazy-loaded image
  | 'data-lazy'
  | 'data-original'
  | string               // any other HTML attribute

export type TransformType =
  | 'trim'
  | 'number'
  | 'url-absolute'
  | 'background-image-url'   // parses url("...") from CSS value

// ─── Field Mapping ───────────────────────────────────────────────────────────
export interface FieldMapping {
  id: string
  label: string
  type: FieldType
  cssSelector: string
  attribute?: AttributeType
  transform?: TransformType
}

// ─── Scraped Data ─────────────────────────────────────────────────────────────
export interface ScrapedRow {
  [key: string]: string | number | null
}

// ─── Session ──────────────────────────────────────────────────────────────────
export type SessionStatus = 'idle' | 'selecting' | 'running' | 'paused' | 'complete' | 'error'

export interface ScrapeSession {
  id: string
  url: string
  siteDomain: string
  mode: ScraperMode
  paginationType: PaginationType
  fields: FieldMapping[]
  rows: ScrapedRow[]
  totalPages: number
  pagesScraped: number
  status: SessionStatus
  startedAt: string
  completedAt?: string
  error?: string
}

// ─── Templates ───────────────────────────────────────────────────────────────
export interface SiteTemplate {
  id: string
  name: string
  domain: string
  listSelector: string
  fields: FieldMapping[]
  paginationType: PaginationType
  nextButtonSelector?: string
  paginationUrlPattern?: string
  spaPaginationContainerSelector?: string   // container to watch for DOM mutations
  delayBetweenPages: number
  createdAt: string
  isPreset?: boolean   // true for built-in presets
}

// ─── Export ───────────────────────────────────────────────────────────────────
export interface ExportOptions {
  format: 'csv' | 'xlsx'
  filename: string
  includeImageUrls: boolean
  embedImagesInXlsx: boolean
  downloadImages: boolean
  columns: string[]
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export type MessageType =
  | 'CONTENT_READY'
  | 'ENABLE_SELECTOR'
  | 'DISABLE_SELECTOR'
  | 'ELEMENT_SELECTED'
  | 'AUTO_FIELDS_DETECTED'
  | 'SCRAPE_PAGE'
  | 'SCRAPE_PAGE_RESULT'
  | 'GO_NEXT_PAGE'
  | 'GO_NEXT_PAGE_RESULT'
  | 'DETECT_PAGINATION'
  | 'PAGINATION_DETECTED'
  | 'SCROLL_TO_BOTTOM'
  | 'PROGRESS_UPDATE'
  | 'SCRAPE_COMPLETE'
  | 'FETCH_IMAGE_BASE64'
  | 'IMAGE_BASE64_RESULT'
  | 'ERROR'
  | 'PING'
  | 'PONG'

export interface ExtensionMessage<T = unknown> {
  type: MessageType
  payload: T
  tabId?: number
}

// ─── Pagination Detection Result ──────────────────────────────────────────────
export interface PaginationInfo {
  type: PaginationType
  totalPages?: number
  nextSelector?: string
  containerSelector?: string
}

// ─── Pattern Detection ───────────────────────────────────────────────────────
export interface PatternDetectionResult {
  matched: boolean
  selector: string
  count: number
  sample?: Element
}

// ─── Progress ────────────────────────────────────────────────────────────────
export interface ProgressUpdate {
  currentPage: number
  totalPages: number
  rowsCollected: number
  status: SessionStatus
}
