import { useState } from 'react'
import type { FieldMapping, FieldType } from '../../shared/types'
import { generateId } from '../../shared/utils'

const FIELD_TYPES: FieldType[] = ['name', 'price', 'image', 'category', 'sku', 'description', 'url', 'custom']

const TYPE_COLORS: Record<FieldType, string> = {
  name:        'badge-green',
  price:       'badge-blue',
  image:       'badge-amber',
  category:    'badge-blue',
  sku:         'badge-blue',
  description: 'badge-blue',
  url:         'badge-blue',
  custom:      'badge-blue',
}

interface Props {
  fields: FieldMapping[]
  onChange: (fields: FieldMapping[]) => void
}

export function FieldMapper({ fields, onChange }: Props) {
  const updateField = (id: string, updates: Partial<FieldMapping>) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id))
  }

  const addField = () => {
    onChange([...fields, {
      id: generateId(),
      label: 'Custom Field',
      type: 'custom',
      cssSelector: '',
      attribute: 'text',
      transform: 'trim',
    }])
  }

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--panel-text-muted)' }}>
          No fields detected yet. Select a product card on the page.
        </p>
      )}

      {fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          onChange={updates => updateField(field.id, updates)}
          onRemove={() => removeField(field.id)}
        />
      ))}

      <button
        className="btn-secondary w-full text-xs py-1.5"
        onClick={addField}
      >
        + Add Field
      </button>
    </div>
  )
}

// ── Individual Field Row ──────────────────────────────────────────────────────
function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: FieldMapping
  onChange: (u: Partial<FieldMapping>) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="field-row flex-col gap-1">
      {/* Top row */}
      <div className="flex items-center gap-2 w-full">
        <span className={`badge ${TYPE_COLORS[field.type]} flex-shrink-0`}>
          {field.type}
        </span>

        <input
          className="input flex-1 text-xs py-1"
          value={field.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder="Column name"
          style={{ fontFamily: 'Inter, sans-serif' }}
        />

        <button
          className="btn-icon w-6 h-6 text-xs flex-shrink-0"
          onClick={() => setExpanded(v => !v)}
          title="Edit selector"
        >
          {expanded ? '▲' : '▼'}
        </button>

        <button
          className="btn-icon w-6 h-6 flex-shrink-0 text-red-400 border-red-900"
          onClick={onRemove}
          title="Remove field"
        >
          ×
        </button>
      </div>

      {/* Expanded selector editor */}
      {expanded && (
        <div className="space-y-1.5 pt-1 pl-1 w-full">
          <div>
            <label className="input-label">Type</label>
            <select
              className="input text-xs py-1"
              value={field.type}
              onChange={e => onChange({ type: e.target.value as FieldType })}
            >
              {FIELD_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label">CSS Selector</label>
            <input
              className="input text-xs py-1"
              value={field.cssSelector}
              onChange={e => onChange({ cssSelector: e.target.value })}
              placeholder="e.g. .product-name or self"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="input-label">Attribute</label>
              <select
                className="input text-xs py-1"
                value={field.attribute ?? 'text'}
                onChange={e => onChange({ attribute: e.target.value as FieldMapping['attribute'] })}
              >
                <option value="text">text content</option>
                <option value="href">href (link)</option>
                <option value="src">src (image)</option>
                <option value="background-image">background-image (CSS)</option>
                <option value="data-src">data-src (lazy)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="input-label">Transform</label>
              <select
                className="input text-xs py-1"
                value={field.transform ?? 'trim'}
                onChange={e => onChange({ transform: e.target.value as FieldMapping['transform'] })}
              >
                <option value="trim">trim</option>
                <option value="number">number</option>
                <option value="url-absolute">absolute URL</option>
                <option value="background-image-url">bg-image URL</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
