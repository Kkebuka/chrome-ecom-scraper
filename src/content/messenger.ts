import type { ExtensionMessage, MessageType } from '../shared/types'

type MessageHandler = (message: ExtensionMessage, sendResponse: (r: unknown) => void) => void | true

/**
 * Message bridge between content script and the side panel / background.
 * Wraps chrome.runtime.onMessage in a cleaner API.
 */
export const messenger = {
  handler: null as MessageHandler | null,

  onMessage(handler: MessageHandler) {
    this.handler = handler
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (this.handler) {
        const result = this.handler(message as ExtensionMessage, sendResponse)
        return result === true ? true : undefined
      }
    })
  },

  send(message: { type: MessageType; payload?: unknown }) {
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel might not be open — ignore
    })
  },
}
