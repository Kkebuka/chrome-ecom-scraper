import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  ScrapeSession,
  FieldMapping,
  PaginationInfo,
  ScrapedRow,
  ScraperMode,
  ExtensionMessage,
} from '../../shared/types'
import { DEFAULT_DELAY_MS } from '../../shared/constants'
import { delay, getDomain, generateId } from '../../shared/utils'

/**
 * useScraper — core hook managing the full scrape session lifecycle.
 *
 * Flow:
 * idle → selecting → field_config → scraping → (pause/resume) → complete
 *
 * Communicates with the content script via chrome.tabs.sendMessage.
 * Receives unsolicited messages (ELEMENT_SELECTED, AUTO_FIELDS_DETECTED)
 * from the content script via chrome.runtime.onMessage.
 */
export function useScraper() {
  const [session, setSession] = useState<ScrapeSession | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [fields, setFields] = useState<FieldMapping[]>([])
  const [listSelector, setListSelector] = useState('')
  const [itemCount, setItemCount] = useState(0)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(null)
  const [maxPages, setMaxPages] = useState(10)
  const [delayMs, setDelayMs] = useState(DEFAULT_DELAY_MS)
  const [rows, setRows] = useState<ScrapedRow[]>([])
  const [status, setStatus] = useState<ScrapeSession['status']>('idle')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ScraperMode>('list')

  const isPausedRef = useRef(false)
  const isStoppedRef = useRef(false)

  // ── Get Active Tab ────────────────────────────────────────────────────────
  const getActiveTab = useCallback(async (): Promise<chrome.tabs.Tab | null> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab ?? null
  }, [])

  const sendToTab = useCallback(async <T>(type: string, payload?: unknown): Promise<T | null> => {
    const tab = await getActiveTab()
    if (!tab?.id) return null
    try {
      return await chrome.tabs.sendMessage(tab.id, { type, payload }) as T
    } catch (e) {
      console.warn('[useScraper] sendToTab error:', e)
      return null
    }
  }, [getActiveTab])

  // ── Listen for messages FROM content script (ELEMENT_SELECTED, etc.) ─────
  // Content script sends via chrome.runtime.sendMessage → background → here.
  // Background stores in storage.local. We poll and listen.
  useEffect(() => {
    const handleMessage = (message: ExtensionMessage) => {
      if (message.type === 'ELEMENT_SELECTED') {
        const payload = message.payload as {
          listSelector: string
          count: number
          allElements: unknown[]
        }
        setListSelector(payload.listSelector)
        setItemCount(payload.count)
        setIsSelecting(false)
        setStatus('idle')
        // Trigger pagination detection after selecting
        sendToTab<{ type: string; payload: PaginationInfo }>('DETECT_PAGINATION').then(resp => {
          if (resp?.payload) setPaginationInfo(resp.payload)
        })
      }

      if (message.type === 'AUTO_FIELDS_DETECTED') {
        const autoFields = message.payload as FieldMapping[]
        if (Array.isArray(autoFields) && autoFields.length > 0) {
          setFields(autoFields)
        }
      }
    }

    // The side panel can receive messages from the background directly
    // via chrome.runtime.onMessage (since service worker forwards them)
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [sendToTab])

  // ── Enable Selector Mode ──────────────────────────────────────────────────
  const startSelecting = useCallback(async () => {
    setIsSelecting(true)
    setStatus('selecting')
    setError(null)
    setFields([])
    setListSelector('')
    setItemCount(0)
    await sendToTab('ENABLE_SELECTOR')
  }, [sendToTab])

  // ── Cancel Selecting ──────────────────────────────────────────────────────
  const cancelSelecting = useCallback(async () => {
    setIsSelecting(false)
    setStatus('idle')
    await sendToTab('DISABLE_SELECTOR')
  }, [sendToTab])

  // ── Load Template ─────────────────────────────────────────────────────────
  const loadTemplate = useCallback((template: {
    listSelector: string
    fields: FieldMapping[]
    paginationType: import('../../shared/types').PaginationType
  }) => {
    setListSelector(template.listSelector)
    setFields(template.fields)
    setPaginationInfo({ type: template.paginationType })
    setStatus('idle')
  }, [])

  // ── Detect Pagination ─────────────────────────────────────────────────────
  const detectPagination = useCallback(async () => {
    const resp = await sendToTab<{ type: string; payload: PaginationInfo }>('DETECT_PAGINATION')
    if (resp?.payload) setPaginationInfo(resp.payload)
  }, [sendToTab])

  // ── Start Scraping ────────────────────────────────────────────────────────
  const startScraping = useCallback(async () => {
    if (!listSelector || fields.length === 0) return

    const tab = await getActiveTab()
    if (!tab?.id || !tab.url) return

    isStoppedRef.current = false
    isPausedRef.current = false

    const sessionId = generateId()
    const domain = getDomain(tab.url)
    const pType = paginationInfo?.type ?? 'none'

    setStatus('running')
    setRows([])
    setError(null)

    const allRows: ScrapedRow[] = []
    let page = 1

    const newSession: ScrapeSession = {
      id: sessionId,
      url: tab.url,
      siteDomain: domain,
      mode,
      paginationType: pType,
      fields,
      rows: [],
      totalPages: maxPages,
      pagesScraped: 0,
      status: 'running',
      startedAt: new Date().toISOString(),
    }
    setSession(newSession)

    try {
      while (page <= maxPages && !isStoppedRef.current) {
        // Wait if paused
        while (isPausedRef.current && !isStoppedRef.current) {
          await delay(200, false)
        }
        if (isStoppedRef.current) break

        // Scrape current page
        const resp = await sendToTab<{ type: string; payload: { rows: ScrapedRow[] } }>('SCRAPE_PAGE', {
          listSelector,
          fields,
        })

        const pageRows = resp?.payload?.rows ?? []
        allRows.push(...pageRows)
        setRows([...allRows])
        setSession(prev => prev ? { ...prev, pagesScraped: page, rows: allRows } : prev)

        // Check if we have more pages
        if (page >= maxPages || pType === 'none') break

        // Polite delay
        await delay(delayMs)

        // Navigate to next page
        if (pType === 'infinite-scroll') {
          const hasMore = await sendToTab<{ payload: { hasMore: boolean } }>('SCROLL_TO_BOTTOM', {
            containerSelector: paginationInfo?.containerSelector,
          })
          if (!hasMore?.payload?.hasMore) break
        } else {
          const nextResp = await sendToTab<{ payload: { success: boolean } }>('GO_NEXT_PAGE', {
            type: pType,
            containerSelector: paginationInfo?.containerSelector,
            nextSelector: paginationInfo?.nextSelector,
          })
          if (!nextResp?.payload?.success) break

          // Wait for SPA to re-render after navigation
          await delay(delayMs)
        }

        page++
      }

      setStatus('complete')
      setSession(prev => prev ? {
        ...prev,
        status: 'complete',
        rows: allRows,
        completedAt: new Date().toISOString(),
      } : prev)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setStatus('error')
      setSession(prev => prev ? { ...prev, status: 'error', error: msg } : prev)
    }
  }, [listSelector, fields, paginationInfo, maxPages, delayMs, mode, sendToTab, getActiveTab])

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const pause = useCallback(() => {
    isPausedRef.current = true
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    isPausedRef.current = false
    setStatus('running')
  }, [])

  const stop = useCallback(() => {
    isStoppedRef.current = true
    isPausedRef.current = false
    setStatus('complete')
  }, [])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setSession(null)
    setRows([])
    setStatus('idle')
    setError(null)
    setListSelector('')
    setFields([])
    setItemCount(0)
    setPaginationInfo(null)
    isStoppedRef.current = false
    isPausedRef.current = false
  }, [])

  return {
    // State
    session, status, rows, fields, listSelector, itemCount,
    paginationInfo, maxPages, delayMs, isSelecting, error, mode,
    // Setters
    setFields, setListSelector, setItemCount, setPaginationInfo,
    setMaxPages, setDelayMs, setMode,
    // Actions
    startSelecting, cancelSelecting, loadTemplate,
    detectPagination,
    startScraping, pause, resume, stop, reset,
  }
}
