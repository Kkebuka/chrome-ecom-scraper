import { useState, useEffect, useCallback } from 'react'
import type { SiteTemplate } from '../../shared/types'
import { STORAGE_KEYS } from '../../shared/constants'
import { getDomain } from '../../shared/utils'
import { BUILT_IN_PRESETS } from '../../shared/presets/mktoys'

/**
 * useTemplates — manages template CRUD in chrome.storage.local.
 * Automatically loads matching templates when the active tab domain changes.
 */
export function useTemplates() {
  const [templates, setTemplates] = useState<SiteTemplate[]>([])
  const [currentDomain, setCurrentDomain] = useState('')
  const [matchingTemplates, setMatchingTemplates] = useState<SiteTemplate[]>([])

  // ── Load Templates for Current Domain ────────────────────────────────────
  const loadForDomain = useCallback(async (domain: string) => {
    setCurrentDomain(domain)
    const key = STORAGE_KEYS.templates(domain)
    const result = await chrome.storage.local.get(key)
    const saved = (result[key] as SiteTemplate[]) ?? []

    // Merge presets + user-saved, presets first
    const presets = BUILT_IN_PRESETS.filter(p => p.domain === domain)
    const all = [...presets, ...saved]
    setTemplates(all)
    setMatchingTemplates(all)
  }, [])

  // ── Watch Active Tab ──────────────────────────────────────────────────────
  useEffect(() => {
    const refreshDomain = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        const domain = getDomain(tab.url)
        await loadForDomain(domain)
      }
    }

    refreshDomain()

    // Re-check when tab changes
    chrome.tabs.onActivated.addListener(refreshDomain)
    chrome.tabs.onUpdated.addListener((_id, info) => {
      if (info.status === 'complete') refreshDomain()
    })

    return () => {
      chrome.tabs.onActivated.removeListener(refreshDomain)
    }
  }, [loadForDomain])

  // ── Save Template ────────────────────────────────────────────────────────
  const saveTemplate = useCallback(async (template: SiteTemplate) => {
    const key = STORAGE_KEYS.templates(template.domain)
    const result = await chrome.storage.local.get(key)
    const existing = (result[key] as SiteTemplate[]) ?? []
    const updated = [...existing.filter(t => t.id !== template.id), template]
    await chrome.storage.local.set({ [key]: updated })
    await loadForDomain(template.domain)
  }, [loadForDomain])

  // ── Delete Template ───────────────────────────────────────────────────────
  const deleteTemplate = useCallback(async (templateId: string, domain: string) => {
    const key = STORAGE_KEYS.templates(domain)
    const result = await chrome.storage.local.get(key)
    const existing = (result[key] as SiteTemplate[]) ?? []
    const updated = existing.filter(t => t.id !== templateId)
    await chrome.storage.local.set({ [key]: updated })
    await loadForDomain(domain)
  }, [loadForDomain])

  // ── All Presets ───────────────────────────────────────────────────────────
  const allPresets = BUILT_IN_PRESETS

  return {
    templates,
    matchingTemplates,
    currentDomain,
    allPresets,
    saveTemplate,
    deleteTemplate,
    loadForDomain,
  }
}
