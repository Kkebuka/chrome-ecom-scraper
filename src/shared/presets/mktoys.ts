import type { SiteTemplate } from '../types'

/**
 * Built-in preset template for mktoys.com product listing pages.
 * Selectors verified against live DOM via browser inspection.
 *
 * ─ Notes on mktoys.com architecture ─
 * - Vue.js SPA with Element Plus UI library
 * - Product cards: <a href='/ProductInfo/...'> anchor wrappers
 * - Images: CSS background-image on <div> elements (NOT <img> tags)
 * - Pagination: Element Plus el-pagination (button.btn-next)
 * - No prices on public pages — login required (session inherited from browser)
 * - URL stays the same on pagination (SPA state change only)
 */
export const MKTOYS_TEMPLATE: SiteTemplate = {
  id: 'mktoys-v1',
  name: 'MK Toys — Product Listing',
  domain: 'mktoys.com',
  listSelector: ".inner-container, a[href^='/ProductInfo/']",
  fields: [
    {
      id: 'mktoys-name',
      label: 'Product Name',
      type: 'name',
      cssSelector: '.desc span, span',
      attribute: 'text',
      transform: 'trim',
    },
    {
      id: 'mktoys-image',
      label: 'Product Image',
      type: 'image',
      cssSelector: 'img.leftImg, div[style*="background-image"]',
      attribute: 'src',
      transform: 'url-absolute',
    },
    {
      id: 'mktoys-price',
      label: 'Price',
      type: 'price',
      cssSelector: '.money',
      attribute: 'text',
      transform: 'trim',
    },
    {
      id: 'mktoys-url',
      label: 'Product URL',
      type: 'url',
      cssSelector: 'self',
      attribute: 'href',
      transform: 'url-absolute',
    },
    {
      id: 'mktoys-sku',
      label: 'SKU / Item Code',
      type: 'sku',
      cssSelector: '.title-information i:first-child, [class*="code"], [class*="sku"]',
      attribute: 'text',
      transform: 'trim',
    },
    {
      id: 'mktoys-category',
      label: 'Category',
      type: 'category',
      cssSelector: '[class*="tag"], [class*="category"], [class*="cat"]',
      attribute: 'text',
      transform: 'trim',
    },
  ],
  paginationType: 'spa-next',
  nextButtonSelector: 'button.btn-next',
  spaPaginationContainerSelector: '.el-main, main, [class*="product-list"], [class*="goods-list"]',
  delayBetweenPages: 2000,
  createdAt: new Date().toISOString(),
  isPreset: true,
}

export const BUILT_IN_PRESETS: SiteTemplate[] = [MKTOYS_TEMPLATE]
