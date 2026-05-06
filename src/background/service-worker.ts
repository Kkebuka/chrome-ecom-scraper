/**
 * EcomScraper — MV3 Service Worker
 *
 * Responsibilities:
 * 1. Open the side panel when the extension icon is clicked
 * 2. Track active tab state
 * 3. Forward messages from content scripts → side panel (chrome.runtime.sendMessage)
 *
 * IMPORTANT: MV3 service workers have no persistent state.
 * All session data must be written to chrome.storage.local immediately.
 */

// ─── Open Side Panel on Icon Click ───────────────────────────────────────────
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return
  chrome.sidePanel.open({ tabId: tab.id })
})

// ─── Allow Side Panel on All URLs ────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)
})

// ─── Message Router ───────────────────────────────────────────────────────────
// Messages from content scripts (ELEMENT_SELECTED, AUTO_FIELDS_DETECTED, etc.)
// must be forwarded to the side panel. Since the side panel shares the same
// extension context, chrome.runtime.sendMessage reaches it directly.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id

  // Content script pings the background to verify injection
  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', payload: { tabId } })
    return true
  }

  // Messages originating from a content script (has a tab) need to be
  // forwarded to the side panel (which has no tab). We do this by
  // re-broadcasting with chrome.runtime.sendMessage.
  // Messages originating from the side panel (no tab) are for background only.
  if (tabId && message.type) {
    // Forward to all extension pages (side panel will receive this)
    chrome.runtime.sendMessage({
      ...message,
      tabId, // attach originating tab so side panel can identify source
    }).catch(() => {
      // Side panel might be closed — that's fine
    })
  }

  return true
})

// ─── Tab Lifecycle ────────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.storage.local.set({ activeTabId: tabId })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.set({
      [`tab_status_${tabId}`]: { status: 'complete', timestamp: Date.now() }
    })
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove([
    `pending_message_${tabId}`,
    `tab_status_${tabId}`,
  ])
})

console.log('[EcomScraper] Service worker started')
