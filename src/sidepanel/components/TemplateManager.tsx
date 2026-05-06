import type { SiteTemplate } from '../../shared/types'
import { useState } from 'react'
import { generateId } from '../../shared/utils'
import type { FieldMapping, PaginationType } from '../../shared/types'

interface Props {
  templates: SiteTemplate[]
  currentDomain: string
  onLoad: (template: SiteTemplate) => void
  onDelete: (id: string, domain: string) => void
  onSave: (template: SiteTemplate) => void
  // For saving current config as template:
  currentListSelector?: string
  currentFields?: FieldMapping[]
  currentPaginationType?: PaginationType
}

export function TemplateManager({
  templates,
  currentDomain,
  onLoad,
  onDelete,
  onSave,
  currentListSelector,
  currentFields,
  currentPaginationType,
}: Props) {
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    if (!saveName.trim() || !currentListSelector || !currentFields?.length) return
    const t: SiteTemplate = {
      id: generateId(),
      name: saveName.trim(),
      domain: currentDomain,
      listSelector: currentListSelector,
      fields: currentFields,
      paginationType: currentPaginationType ?? 'none',
      delayBetweenPages: 1500,
      createdAt: new Date().toISOString(),
    }
    onSave(t)
    setSaveName('')
    setSaving(false)
  }

  return (
    <div className="space-y-2">
      {templates.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--panel-text-muted)' }}>
          No templates for this site yet.
        </p>
      ) : (
        templates.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-2 p-2 rounded-lg"
            style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--panel-text)' }}>
                {t.name}
                {t.isPreset && <span className="ml-1 badge badge-amber" style={{ fontSize: '9px' }}>preset</span>}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--panel-text-muted)' }}>
                {t.fields.length} fields · {t.paginationType}
              </p>
            </div>
            <button
              className="btn-primary py-1 px-3 text-xs"
              onClick={() => onLoad(t)}
            >
              Load
            </button>
            {!t.isPreset && (
              <button
                className="btn-icon w-6 h-6 text-red-400"
                onClick={() => onDelete(t.id, t.domain)}
                title="Delete template"
              >
                ×
              </button>
            )}
          </div>
        ))
      )}

      {/* Save Current Config */}
      {currentListSelector && currentFields && currentFields.length > 0 && (
        <div className="mt-3">
          {!saving ? (
            <button
              className="btn-secondary w-full text-xs py-2"
              onClick={() => setSaving(true)}
            >
              💾 Save as Template
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                id="template-name-input"
                className="input flex-1 text-xs py-1"
                placeholder="Template name…"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
              <button className="btn-primary text-xs py-1 px-3" onClick={handleSave}>Save</button>
              <button className="btn-secondary text-xs py-1 px-2" onClick={() => setSaving(false)}>✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
