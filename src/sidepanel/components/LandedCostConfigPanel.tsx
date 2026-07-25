import type { LandedCostConfig } from '../../shared/types'
import { DEFAULT_LANDED_COST_CONFIG } from '../../shared/constants'

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  config: LandedCostConfig
  onChange: (updated: LandedCostConfig) => void
}

interface FieldProps {
  label: string
  sublabel?: string
  value: number
  onChange: (val: number) => void
  prefix?: string
  step?: string
}

// ── Helpers / Sub-components ──────────────────────────────────────────────────
function NumberInputField({ label, sublabel, value, onChange, prefix, step = 'any' }: FieldProps) {
  return (
    <div>
      <label className="text-xs font-medium block" style={{ color: 'var(--panel-text)' }}>
        {label}
      </label>
      {sublabel && (
        <span className="text-[10px] block mb-1" style={{ color: 'var(--panel-text-muted)' }}>
          {sublabel}
        </span>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-2.5 text-xs font-semibold select-none" style={{ color: 'var(--panel-text-muted)' }}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          className="input text-xs w-full"
          style={{ paddingLeft: prefix ? '24px' : '8px' }}
          value={value ?? ''}
          onChange={e => {
            const parsed = parseFloat(e.target.value)
            onChange(isNaN(parsed) ? 0 : parsed)
          }}
        />
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LandedCostConfigPanel({ config, onChange }: Props) {
  const handleReset = () => {
    onChange({ ...DEFAULT_LANDED_COST_CONFIG })
  }

  return (
    <div className="space-y-3 p-3 rounded-lg border" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="section-title text-xs m-0 flex items-center gap-1.5">
          <span>🇳🇬</span> Naira Price Calculation Settings
        </h3>
        <button
          type="button"
          className="text-[11px] underline cursor-pointer"
          style={{ color: 'var(--panel-text-muted)' }}
          onClick={handleReset}
        >
          Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <NumberInputField
          label="Dollar Rate ($1 USD)"
          sublabel="NGN / USD exchange rate"
          prefix="₦"
          value={config.dollarRate}
          onChange={v => onChange({ ...config, dollarRate: v })}
        />

        <NumberInputField
          label="Freight Cost ($)"
          sublabel="Total container freight"
          prefix="$"
          value={config.freightUSD}
          onChange={v => onChange({ ...config, freightUSD: v })}
        />

        <NumberInputField
          label="Clearing Fee (₦)"
          sublabel="Total container clearing"
          prefix="₦"
          value={config.clearingNGN}
          onChange={v => onChange({ ...config, clearingNGN: v })}
        />

        <NumberInputField
          label="Container CBM"
          sublabel="Total container capacity"
          value={config.containerCBM}
          onChange={v => onChange({ ...config, containerCBM: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1 border-t" style={{ borderColor: 'var(--panel-border)' }}>
        <NumberInputField
          label="Default CBM Fallback"
          sublabel="If card CBM is missing"
          value={config.defaultCBM ?? 0.1}
          onChange={v => onChange({ ...config, defaultCBM: v })}
        />

        <NumberInputField
          label="Default Outer Packing"
          sublabel="If card PCS is missing"
          value={config.defaultQtyPerCarton ?? 1}
          onChange={v => onChange({ ...config, defaultQtyPerCarton: v })}
        />
      </div>

      <div className="pt-1 border-t" style={{ borderColor: 'var(--panel-border)' }}>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--panel-text)' }}>
          Scraped Price Basis
        </label>
        <select
          className="input text-xs w-full py-1"
          value={config.isUnitPrice ?? true ? 'unit' : 'carton'}
          onChange={e => onChange({ ...config, isUnitPrice: e.target.value === 'unit' })}
        >
          <option value="unit">Single Item Price (Scraped Price × Outer Packing = Carton Price)</option>
          <option value="carton">Full Carton Price (Scraped Price = Carton Price)</option>
        </select>
        <span className="text-[10px] block mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>
          {config.isUnitPrice ?? true
            ? 'Multiplies single item price by Outer Packing (PCS) to calculate Total Carton Cost.'
            : 'Uses scraped price directly as Total Carton Price.'}
        </span>
      </div>
    </div>
  )
}
