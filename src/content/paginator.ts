import type { PaginationType, PaginationInfo } from '../shared/types'
import {
  NEXT_BUTTON_SELECTORS,
  NUMBERED_PAGINATION_SELECTORS,
  LOAD_MORE_SELECTORS,
  INFINITE_SCROLL_SENTINELS,
  SPA_MUTATION_TIMEOUT_MS,
} from '../shared/constants'
import { delay } from '../shared/utils'

/**
 * PaginationEngine — detects what type of pagination a page uses,
 * then navigates to the next page appropriately.
 *
 * SPA-aware: for Vue/React SPAs (like mktoys.com), uses MutationObserver
 * to detect when DOM has updated after a pagination click, rather than
 * waiting for a full page navigation.
 */
export class PaginationEngine {

  // ── Detection ─────────────────────────────────────────────────────────────
  detect(): PaginationInfo {
    // Element Plus SPA pagination (mktoys.com et al.)
    if (document.querySelector('ul.el-pager') || document.querySelector('button.btn-next')) {
      return {
        type: 'spa-next',
        nextSelector: 'button.btn-next',
        containerSelector: this.guessSpaContainer(),
      }
    }

    // Numbered/next-button pagination
    const nextBtn = this.findFirst(NEXT_BUTTON_SELECTORS)
    if (nextBtn) {
      return {
        type: 'next-button',
        nextSelector: this.matchedSelector(NEXT_BUTTON_SELECTORS) ?? undefined,
      }
    }

    const numberedPage = this.findFirst(NUMBERED_PAGINATION_SELECTORS)
    if (numberedPage) {
      return { type: 'numbered' }
    }

    // Load More
    const loadMore = this.findFirst(LOAD_MORE_SELECTORS)
    if (loadMore) {
      return { type: 'load-more' }
    }

    // Infinite Scroll sentinels
    const sentinel = this.findFirst(INFINITE_SCROLL_SENTINELS)
    if (sentinel) {
      return { type: 'infinite-scroll' }
    }

    return { type: 'none' }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  async goToNextPage(
    type: PaginationType,
    containerSelector?: string,
    nextSelector?: string
  ): Promise<boolean> {
    switch (type) {
      case 'spa-next':
        return this.clickSpaNext(
          nextSelector ?? 'button.btn-next',
          containerSelector
        )

      case 'next-button':
        return this.clickNext(nextSelector)

      case 'numbered':
        return this.clickNext(nextSelector ?? this.matchedSelector(NEXT_BUTTON_SELECTORS) ?? undefined)

      case 'load-more':
        return this.clickLoadMore()

      case 'infinite-scroll':
        return false  // handled by InfiniteScrollHandler

      default:
        return false
    }
  }

  // ── SPA-aware Next (MutationObserver + fallback delay) ────────────────────
  private async clickSpaNext(
    nextSelector: string,
    containerSelector?: string
  ): Promise<boolean> {
    const btn = document.querySelector(nextSelector) as HTMLButtonElement | null
    if (!btn || btn.disabled || btn.classList.contains('is-disabled')) return false

    const container = containerSelector
      ? document.querySelector(containerSelector)
      : document.body

    return new Promise<boolean>((resolve) => {
      let resolved = false

      // Watch for DOM mutations in the product container
      const observer = new MutationObserver(() => {
        if (!resolved) {
          resolved = true
          observer.disconnect()
          resolve(true)
        }
      })

      if (container) {
        observer.observe(container, { childList: true, subtree: true })
      }

      // Click the next button
      btn.click()

      // Fallback: resolve after timeout even if no mutation observed
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          observer.disconnect()
          resolve(true)
        }
      }, SPA_MUTATION_TIMEOUT_MS)
    })
  }

  // ── Standard Next Button ──────────────────────────────────────────────────
  private async clickNext(nextSelector?: string): Promise<boolean> {
    const selectors = nextSelector ? [nextSelector] : NEXT_BUTTON_SELECTORS

    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null
      if (el && !this.isDisabled(el)) {
        el.click()
        await delay(500, false)  // short pause then return — page navigates
        return true
      }
    }
    return false
  }

  // ── Load More ─────────────────────────────────────────────────────────────
  private async clickLoadMore(): Promise<boolean> {
    for (const sel of LOAD_MORE_SELECTORS) {
      const el = document.querySelector(sel) as HTMLElement | null
      if (el && !this.isDisabled(el)) {
        el.click()
        await delay(1500, false)
        return true
      }
    }
    return false
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private findFirst(selectors: string[]): Element | null {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel)
        if (el) return el
      } catch { /* ignore bad selectors */ }
    }
    return null
  }

  private matchedSelector(selectors: string[]): string | null {
    for (const sel of selectors) {
      try {
        if (document.querySelector(sel)) return sel
      } catch { /* skip */ }
    }
    return null
  }

  private isDisabled(el: HTMLElement): boolean {
    return (
      el.hasAttribute('disabled') ||
      el.classList.contains('disabled') ||
      el.classList.contains('is-disabled') ||
      el.getAttribute('aria-disabled') === 'true'
    )
  }

  private guessSpaContainer(): string {
    const candidates = [
      '.el-main',
      'main',
      '[class*="product-list"]',
      '[class*="goods-list"]',
      '[class*="item-list"]',
      '[class*="content"]',
    ]
    for (const sel of candidates) {
      if (document.querySelector(sel)) return sel
    }
    return 'body'
  }
}
