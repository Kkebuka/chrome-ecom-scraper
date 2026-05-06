import { messenger } from './messenger'
import { SelectorEngine, type SelectionResult } from './selector'
import { Extractor } from './extractor'
import { PaginationEngine } from './paginator'
import { InfiniteScrollHandler } from './infinite-scroll'
import type { FieldMapping, ExtensionMessage, ScrapedRow } from '../shared/types'

/**
 * Content Script Entry Point — injected into every page at document_idle.
 * Initialises all modules and wires up the message listener.
 */

const selector = new SelectorEngine()
const extractor = new Extractor()
const paginator = new PaginationEngine()
const scrollHandler = new InfiniteScrollHandler()

// ─── Message Handler ──────────────────────────────────────────────────────────
messenger.onMessage((message: ExtensionMessage, sendResponse: (r: unknown) => void) => {
  switch (message.type) {

    case 'PING':
      sendResponse({ type: 'PONG', payload: { url: location.href } })
      break

    // ── Selector Mode ────────────────────────────────────────────────────────
    case 'ENABLE_SELECTOR':
      selector.enable((result: SelectionResult) => {
        messenger.send({ type: 'ELEMENT_SELECTED', payload: result })
        messenger.send({ type: 'AUTO_FIELDS_DETECTED', payload: extractor.autoDetectFields(result.element) })
      })
      sendResponse({ ok: true })
      break

    case 'DISABLE_SELECTOR':
      selector.disable()
      sendResponse({ ok: true })
      break

    // ── Extraction ───────────────────────────────────────────────────────────
    case 'SCRAPE_PAGE': {
      const { listSelector, fields } = message.payload as {
        listSelector: string
        fields: FieldMapping[]
      }
      const rows: ScrapedRow[] = extractor.extractAllRows(listSelector, fields)
      sendResponse({ type: 'SCRAPE_PAGE_RESULT', payload: { rows } })
      break
    }

    // ── Pagination Detection ─────────────────────────────────────────────────
    case 'DETECT_PAGINATION': {
      const info = paginator.detect()
      sendResponse({ type: 'PAGINATION_DETECTED', payload: info })
      break
    }

    // ── Next Page ────────────────────────────────────────────────────────────
    case 'GO_NEXT_PAGE': {
      const { type: pType, containerSelector, nextSelector } = message.payload as {
        type: string
        containerSelector?: string
        nextSelector?: string
      }
      paginator.goToNextPage(
        pType as never,
        containerSelector,
        nextSelector
      ).then((success: boolean) => {
        sendResponse({ type: 'GO_NEXT_PAGE_RESULT', payload: { success } })
      })
      return true // async response
    }

    // ── Infinite Scroll ───────────────────────────────────────────────────────
    case 'SCROLL_TO_BOTTOM': {
      const { containerSelector } = message.payload as { containerSelector?: string }
      scrollHandler.scrollAndWait(containerSelector).then((hasMore: boolean) => {
        sendResponse({ payload: { hasMore } })
      })
      return true // async response
    }

    // ── Image Fetch (for XLSX embedding) ─────────────────────────────────────
    // Fetches image, decodes via canvas, re-encodes as a 120×120 JPEG thumbnail.
    // This keeps file size small and handles webp/avif formats transparently.
    case 'FETCH_IMAGE_BASE64': {
      const { url, thumbSize = 120 } = message.payload as { url: string; thumbSize?: number }
      fetch(url)
        .then(resp => resp.blob())
        .then(blob => {
          const imgEl = new Image()
          const blobUrl = URL.createObjectURL(blob)
          imgEl.onload = () => {
            // Compute thumbnail dimensions preserving aspect ratio
            const srcW = imgEl.naturalWidth || thumbSize
            const srcH = imgEl.naturalHeight || thumbSize
            const scale = Math.min(thumbSize / srcW, thumbSize / srcH, 1) // never upscale
            const dstW = Math.round(srcW * scale)
            const dstH = Math.round(srcH * scale)

            const canvas = document.createElement('canvas')
            canvas.width = dstW
            canvas.height = dstH
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              sendResponse({ type: 'IMAGE_BASE64_RESULT', payload: { base64: null } })
              return
            }
            ctx.drawImage(imgEl, 0, 0, dstW, dstH)
            URL.revokeObjectURL(blobUrl)
            // Quality 0.88 — sharp and detailed at 160px thumbnail size
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
            const base64 = dataUrl.split(',')[1]
            sendResponse({ type: 'IMAGE_BASE64_RESULT', payload: { base64, mimeType: 'image/jpeg', width: dstW, height: dstH } })
          }
          imgEl.onerror = () => {
            URL.revokeObjectURL(blobUrl)
            sendResponse({ type: 'IMAGE_BASE64_RESULT', payload: { base64: null } })
          }
          imgEl.src = blobUrl
        })
        .catch(() => {
          sendResponse({ type: 'IMAGE_BASE64_RESULT', payload: { base64: null } })
        })
      return true // async response
    }

    default:
      break
  }
  return true
})

console.log('[EcomScraper] Content script ready on', location.hostname)
