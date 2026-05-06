import { INFINITE_SCROLL_TIMEOUT_MS } from '../shared/constants'

/**
 * InfiniteScrollHandler — scrolls to the bottom of the page and
 * waits for new content to appear using MutationObserver.
 * Returns true if new content was detected, false if the feed appears to have ended.
 */
export class InfiniteScrollHandler {

  async scrollAndWait(containerSelector?: string): Promise<boolean> {
    const container = containerSelector
      ? document.querySelector(containerSelector)
      : null

    const countBefore = container
      ? container.children.length
      : document.querySelectorAll('*').length

    // Scroll to bottom
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })

    return new Promise<boolean>((resolve) => {
      let resolved = false

      const observer = new MutationObserver(() => {
        const countAfter = container
          ? container.children.length
          : document.querySelectorAll('[class*="product"], [class*="item"], [class*="goods"]').length

        if (countAfter > countBefore && !resolved) {
          resolved = true
          observer.disconnect()
          resolve(true)
        }
      })

      const watchTarget = container ?? document.body
      observer.observe(watchTarget, { childList: true, subtree: true })

      // Timeout — if nothing changes in 3s, assume last page
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          observer.disconnect()
          resolve(false)
        }
      }, INFINITE_SCROLL_TIMEOUT_MS)
    })
  }
}
