import type { LandedCostConfig, LandedCostResult, ScrapedRow } from './types'
import { DEFAULT_LANDED_COST_CONFIG } from './constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Cleanly extract a price number from a string, e.g.:
 * "$ 6.8782" -> 6.8782
 * "135.6768" -> 135.6768
 */
export function extractNumber(val: unknown): number | null {
  if (typeof val === 'number') return isNaN(val) ? null : val
  if (typeof val !== 'string' || !val.trim()) return null

  const cleaned = val.replace(/,/g, '')
  const match = cleaned.match(/[\d.]+/)?.[0]
  if (!match) return null

  const num = parseFloat(match)
  return isNaN(num) ? null : num
}

/**
 * Specifically extract CBM from text containing "CBM(m³): 0.282" or "0.282".
 * Prevents false positives from SKUs like "MKB289071".
 */
export function extractCBM(val: unknown, defaultFallback = 0.1): number {
  if (typeof val === 'number') return val > 0 ? val : defaultFallback
  if (typeof val === 'string' && val.trim()) {
    // Direct match for CBM(m³): 0.282 or CBM: 0.282 or CBM 0.282
    const cbmMatch = val.match(/CBM(?:\(m³\))?[:\s]+([\d.]+)/i)
    if (cbmMatch?.[1]) {
      const num = parseFloat(cbmMatch[1])
      if (!isNaN(num) && num > 0) return num
    }

    // Decimal number matching 0.xxx if string isn't an SKU
    if (!/MKB|\b[A-Z]{2,}\d+/i.test(val)) {
      const decimalMatch = val.match(/\b0\.\d+\b/)
      if (decimalMatch?.[0]) {
        const num = parseFloat(decimalMatch[0])
        if (!isNaN(num) && num > 0) return num
      }
    }
  }
  return defaultFallback
}

/**
 * Specifically extract Quantity Per Carton (Outer Packing) from text like "Outer Packing: 144" or "144".
 */
export function extractQtyPerCarton(val: unknown, defaultFallback = 1): number {
  if (typeof val === 'number') return val > 0 ? val : defaultFallback
  if (typeof val === 'string' && val.trim()) {
    // Direct match for Outer Packing: 144 or Packing: 144 or 144 Pcs
    const qtyMatch = val.match(/(?:Outer\s*Packing|Packing|Pcs\/Carton|PCS|Qty|Quantity)[:\s]+(\d+)/i)
    if (qtyMatch?.[1]) {
      const num = parseInt(qtyMatch[1], 10)
      if (!isNaN(num) && num > 0) return num
    }

    // Standalone integer if string is short and not an SKU
    if (!/MKB|\b[A-Z]{2,}\d+/i.test(val) && val.length <= 10) {
      const numMatch = val.match(/\b\d+\b/)
      if (numMatch?.[0]) {
        const num = parseInt(numMatch[0], 10)
        if (!isNaN(num) && num > 0) return num
      }
    }
  }
  return defaultFallback
}

/**
 * Formats a number into Nigerian Naira string, e.g. ₦ 309,292
 */
export function formatNaira(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₦ 0'
  return `₦ ${Math.round(amount).toLocaleString('en-NG')}`
}

// ── Main Landed Cost Calculator ───────────────────────────────────────────────

/**
 * Calculates landed cost per carton & cost per piece ("Naira price") based on formulas:
 * 
 * If isUnitPrice = true (scraped price is unit price per piece):
 *   cartonPriceUSD = scrapedPriceUSD * quantityPerCarton
 * 
 * 1. goodsValueNGN = cartonPriceUSD * dollarRate
 * 2. freightNGN = (cartonCBM / containerCBM) * freightUSD * dollarRate
 * 3. clearingPerCarton = (cartonCBM / containerCBM) * clearingNGN
 * 4. totalCartonCostNGN = goodsValueNGN + freightNGN + clearingPerCarton
 * 5. costPerPieceNGN = totalCartonCostNGN / quantityPerCarton
 */
export function calculateLandedCost(
  scrapedPriceUSD: number,
  cartonCBM: number,
  quantityPerCarton: number,
  config: Partial<LandedCostConfig> = {}
): LandedCostResult {
  const containerCBM = config.containerCBM ?? DEFAULT_LANDED_COST_CONFIG.containerCBM
  const clearingNGN = config.clearingNGN ?? DEFAULT_LANDED_COST_CONFIG.clearingNGN
  const freightUSD = config.freightUSD ?? DEFAULT_LANDED_COST_CONFIG.freightUSD
  const dollarRate = config.dollarRate ?? DEFAULT_LANDED_COST_CONFIG.dollarRate
  const isUnitPrice = config.isUnitPrice ?? DEFAULT_LANDED_COST_CONFIG.isUnitPrice

  const safeQty = Math.max(1, quantityPerCarton)
  const safePrice = Math.max(0, scrapedPriceUSD)
  const safeCBM = Math.max(0, cartonCBM)
  const safeContainerCBM = containerCBM > 0 ? containerCBM : 66.65

  // If scraped price is unit price, multiply by qty to get total carton price in USD
  const cartonPriceUSD = isUnitPrice ? safePrice * safeQty : safePrice

  // 1. Goods Value NGN
  const goodsValueNGN = cartonPriceUSD * dollarRate

  // 2. Freight NGN (apportioned by CBM ratio)
  const cbmRatio = safeCBM / safeContainerCBM
  const freightNGN = cbmRatio * freightUSD * dollarRate

  // 3. Clearing Fee Per Carton (apportioned by CBM ratio)
  const clearingPerCarton = cbmRatio * clearingNGN

  // 4. Total Carton Cost NGN
  const totalCartonCostNGN = goodsValueNGN + freightNGN + clearingPerCarton

  // 5. Cost Per Piece (Naira price)
  const costPerPieceNGN = totalCartonCostNGN / safeQty

  return {
    goodsValueNGN: Math.round(goodsValueNGN * 100) / 100,
    freightNGN: Math.round(freightNGN * 100) / 100,
    clearingPerCarton: Math.round(clearingPerCarton * 100) / 100,
    totalCartonCostNGN: Math.round(totalCartonCostNGN),
    costPerPieceNGN: Math.round(costPerPieceNGN),
    formattedCostPerPiece: formatNaira(costPerPieceNGN),
    formattedTotalCartonCost: formatNaira(totalCartonCostNGN),
  }
}

/**
 * Calculates Landed Cost directly from a scraped row by searching row fields and full row text.
 */
export function calculateRowLandedCost(
  row: ScrapedRow,
  config: Partial<LandedCostConfig> = {}
): LandedCostResult {
  // Join all row values to search as full text fallback
  const fullRowText = Object.values(row)
    .filter(v => typeof v === 'string' || typeof v === 'number')
    .join(' ')

  // 1. Find price value
  let priceUSD = 0
  for (const [key, val] of Object.entries(row)) {
    if (/price|cost|amount/i.test(key)) {
      const extracted = extractNumber(val)
      if (extracted !== null && extracted > 0) {
        priceUSD = extracted
        break
      }
    }
  }

  // 2. Find CBM value
  const defaultCbmFallback = config.defaultCBM ?? DEFAULT_LANDED_COST_CONFIG.defaultCBM
  let cbm = defaultCbmFallback

  for (const [key, val] of Object.entries(row)) {
    if (/cbm|volume/i.test(key)) {
      const extracted = extractCBM(val, 0)
      if (extracted > 0) {
        cbm = extracted
        break
      }
    }
  }
  // Fallback: search full row text for CBM
  if (cbm === defaultCbmFallback) {
    const textCbm = extractCBM(fullRowText, defaultCbmFallback)
    if (textCbm > 0) cbm = textCbm
  }

  // 3. Find Quantity Per Carton (Outer Packing)
  const defaultQtyFallback = config.defaultQtyPerCarton ?? DEFAULT_LANDED_COST_CONFIG.defaultQtyPerCarton
  let qty = defaultQtyFallback

  for (const [key, val] of Object.entries(row)) {
    if (/packing|pcs|qty|quantity|outer/i.test(key)) {
      const extracted = extractQtyPerCarton(val, 0)
      if (extracted > 0) {
        qty = extracted
        break
      }
    }
  }
  // Fallback: search full row text for Outer Packing
  if (qty === defaultQtyFallback) {
    const textQty = extractQtyPerCarton(fullRowText, defaultQtyFallback)
    if (textQty > 0) qty = textQty
  }

  return calculateLandedCost(priceUSD, cbm, qty, config)
}

/**
 * Helper returning costPerPieceNGN directly for compatibility.
 */
export function calculateRowNairaPrice(
  row: ScrapedRow,
  config: Partial<LandedCostConfig> = {}
): number {
  return calculateRowLandedCost(row, config).costPerPieceNGN
}
