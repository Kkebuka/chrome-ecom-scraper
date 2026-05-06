# EcomScraper Project Reference

This document is a comprehensive technical reference for the EcomScraper project. It explains what the project does, how it is structured, how the browser extension pieces communicate, and how the scraping, pagination, templates, and export flows work.

## 1. Project Overview

EcomScraper is a Chrome Manifest V3 browser extension for scraping product listings from e-commerce websites. It provides a side panel UI where a user can select product cards on the current page, auto-detect product fields, scrape one or more listing pages, preview collected rows, and export the result to CSV or Excel.

The project is built with:

- React for the side panel UI.
- TypeScript for app, content script, and extension code.
- Vite for development and build.
- `@crxjs/vite-plugin` for Chrome extension bundling.
- Tailwind CSS plus custom CSS variables for styling.
- ExcelJS for generating `.xlsx` exports with optional embedded product images.
- Chrome extension APIs for side panel, tab messaging, downloads, and local storage.

At a high level, EcomScraper has three runtime areas:

- **Side panel UI**: React app shown in Chrome's extension side panel.
- **Content script**: Injected into web pages, handles element selection, DOM extraction, pagination clicks, scrolling, and image conversion.
- **Background service worker**: Opens the side panel, tracks tab lifecycle, and forwards page-originating messages to extension pages.

## 2. Important Capabilities

The current implementation supports:

- Point-and-click product card selection.
- Automatic detection of repeated listing elements.
- Automatic field detection for common product data:
  - Product image
  - Price
  - Product name
  - Product URL
- Manual field editing.
- Custom fields.
- Product list scraping from CSS selectors.
- Multiple pagination strategies:
  - Single page
  - Standard next button
  - Numbered pagination
  - Load more button
  - Infinite scroll
  - SPA next-button pagination with `MutationObserver`
- Template loading and saving per domain.
- Built-in preset template for `mktoys.com`.
- Live preview of scraped rows.
- Pause, resume, stop, and reset controls.
- CSV export.
- XLSX export.
- XLSX image embedding through thumbnail conversion in the content script.
- Optional bulk product image download.

## 3. Repository Layout

```text
.
├── manifest.json
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── eslint.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── generate-icons.cjs
├── index.html
├── src
│   ├── background
│   │   └── service-worker.ts
│   ├── content
│   │   ├── extractor.ts
│   │   ├── index.ts
│   │   ├── infinite-scroll.ts
│   │   ├── messenger.ts
│   │   ├── paginator.ts
│   │   └── selector.ts
│   ├── shared
│   │   ├── constants.ts
│   │   ├── presets
│   │   │   └── mktoys.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   └── sidepanel
│       ├── App.tsx
│       ├── index.css
│       ├── index.html
│       ├── main.tsx
│       ├── components
│       │   ├── DataTable.tsx
│       │   ├── ExportPanel.tsx
│       │   ├── FieldMapper.tsx
│       │   ├── ModeSelector.tsx
│       │   ├── PaginationConfig.tsx
│       │   ├── StatusBar.tsx
│       │   └── TemplateManager.tsx
│       └── hooks
│           ├── useExport.ts
│           ├── useScraper.ts
│           └── useTemplates.ts
└── public
    ├── favicon.svg
    ├── icons.svg
    └── icons
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

Generated or distributable files also exist:

- `dist/`: Vite/CRX build output.
- `node_modules/`: installed dependencies.
- `package-lock.json`: npm dependency lockfile.
- `ecomscraper-1.0.0.zip`: packaged extension archive.
- `tsconfig.tsbuildinfo`: TypeScript build metadata.

## 4. Runtime Architecture

### 4.1 Side Panel

The side panel is a React app mounted by `src/sidepanel/main.tsx` into `src/sidepanel/index.html`.

Primary files:

- `src/sidepanel/App.tsx`: Composes the whole side panel experience.
- `src/sidepanel/hooks/useScraper.ts`: Owns scraping session state and coordinates messages to the content script.
- `src/sidepanel/hooks/useTemplates.ts`: Loads, saves, deletes, and merges templates.
- `src/sidepanel/hooks/useExport.ts`: Handles CSV, XLSX, image embedding, and image downloads.

The side panel is the user's control center. It does not directly inspect the target webpage DOM. Instead, it sends messages to the content script running in the active tab.

### 4.2 Content Script

The content script is injected on every URL according to `manifest.json`.

Primary files:

- `src/content/index.ts`: Entry point and message dispatcher.
- `src/content/selector.ts`: Handles hover highlighting, click selection, and repeated-pattern detection.
- `src/content/extractor.ts`: Extracts rows and auto-detects fields.
- `src/content/paginator.ts`: Detects and advances pagination.
- `src/content/infinite-scroll.ts`: Scrolls and waits for additional content.
- `src/content/messenger.ts`: Wraps runtime message handling.

The content script is where page DOM access happens. It can call `document.querySelector`, inspect elements, click pagination buttons, scroll the page, and convert images through canvas.

### 4.3 Background Service Worker

The background script is `src/background/service-worker.ts`.

Responsibilities:

- Opens the side panel when the extension action is clicked.
- Enables side panel behavior on install.
- Forwards messages from content scripts to extension pages.
- Stores active tab id and simple tab completion state in `chrome.storage.local`.
- Cleans tab-specific keys when tabs close.

Because it is Manifest V3, the service worker is not persistent. Long-lived scraping state belongs in the side panel and, where needed, `chrome.storage.local`.

## 5. Chrome Extension Manifest

`manifest.json` defines the extension as Manifest V3:

```json
{
  "manifest_version": 3,
  "name": "EcomScraper",
  "version": "1.0.0"
}
```

Important permissions:

- `activeTab`: Access the currently active tab after user interaction.
- `scripting`: Extension scripting capability.
- `storage`: Store templates and tab/session state.
- `sidePanel`: Use Chrome side panel API.
- `tabs`: Query and track active tabs.
- `downloads`: Save CSV, XLSX, and image files.
- `<all_urls>` host permissions: Allows the content script to run and scrape across websites.

Declared runtime pieces:

- Background service worker: `src/background/service-worker.ts`
- Content script: `src/content/index.ts`
- Side panel page: `src/sidepanel/index.html`
- Extension action icon and title.

## 6. Build and Tooling

### 6.1 npm Scripts

From `package.json`:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

Common commands:

```bash
npm install
npm run dev
npm run build
npm run lint
```

### 6.2 Vite Configuration

`vite.config.ts` uses:

- `@vitejs/plugin-react`
- `@crxjs/vite-plugin`
- `vite-plugin-node-polyfills`

The CRX plugin reads `manifest.json`, allowing Vite to bundle the extension. Node polyfills are included for `buffer`, `stream`, and `util`, mainly to support browser-side ExcelJS usage.

The build input explicitly points to:

```ts
src/sidepanel/index.html
```

### 6.3 TypeScript

The root `tsconfig.json` is strict and includes Chrome types. `tsconfig.app.json` is stricter for app builds, including:

- `strict`
- `noUnusedLocals`
- `noUnusedParameters`
- `noUncheckedSideEffectImports`
- `erasableSyntaxOnly`

### 6.4 ESLint

`eslint.config.js` uses:

- `@eslint/js`
- `typescript-eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`

The `dist` folder is ignored.

### 6.5 Tailwind and Styling

Tailwind scans side panel and source files. Custom brand colors and fonts are defined in `tailwind.config.js`, while most app-specific component styles live in `src/sidepanel/index.css`.

## 7. Shared Types

Shared TypeScript types live in `src/shared/types.ts`.

### 7.1 Scraper Modes

```ts
type ScraperMode = 'list' | 'click' | 'url-batch'
```

Current UI exposes all three modes, but only the `list` flow is fully wired in the app. `click` and `url-batch` are represented in the mode selector but do not yet have complete workflow implementations.

### 7.2 Pagination Types

```ts
type PaginationType =
  | 'numbered'
  | 'next-button'
  | 'infinite-scroll'
  | 'load-more'
  | 'spa-next'
  | 'none'
```

`spa-next` exists for JavaScript-rendered sites where clicking next updates the DOM without a full URL change.

### 7.3 Field Mapping

Each output column is represented by a `FieldMapping`:

```ts
interface FieldMapping {
  id: string
  label: string
  type: FieldType
  cssSelector: string
  attribute?: AttributeType
  transform?: TransformType
}
```

Important fields:

- `label`: Column name in preview/export.
- `type`: Semantic type such as `name`, `price`, `image`, or `url`.
- `cssSelector`: Selector relative to a product card container, or `self`.
- `attribute`: What to read from the resolved element.
- `transform`: Cleanup or conversion step.

### 7.4 Scraped Rows

Rows are flexible objects:

```ts
interface ScrapedRow {
  [key: string]: string | number | null
}
```

Each key is usually a field label.

### 7.5 Session

`ScrapeSession` stores session metadata:

- Session id
- Original URL
- Site domain
- Mode
- Pagination type
- Field mappings
- Scraped rows
- Total page limit
- Pages scraped
- Status
- Start and completion timestamps
- Optional error

Session status can be:

```ts
'idle' | 'selecting' | 'running' | 'paused' | 'complete' | 'error'
```

## 8. Shared Constants

`src/shared/constants.ts` centralizes defaults and selector pools.

Important timing constants:

- `DEFAULT_DELAY_MS = 1500`
- `MIN_DELAY_MS = 500`
- `MAX_DELAY_MS = 5000`
- `JITTER_FACTOR = 0.4`
- `SPA_MUTATION_TIMEOUT_MS = 3000`
- `INFINITE_SCROLL_TIMEOUT_MS = 3000`
- `IMAGE_FETCH_DELAY_MS = 200`

Important detection constants:

- `MIN_REPEATING_ITEMS = 3`
- `PRICE_SELECTORS`
- `NAME_SELECTORS`
- `IMAGE_SELECTORS`
- `NEXT_BUTTON_SELECTORS`
- `LOAD_MORE_SELECTORS`
- `NUMBERED_PAGINATION_SELECTORS`
- `INFINITE_SCROLL_SENTINELS`

Chrome storage keys are generated through:

```ts
STORAGE_KEYS.templates(domain)
STORAGE_KEYS.session
STORAGE_KEYS.settings
```

Only template storage is currently used deeply in the app.

## 9. Shared Utilities

`src/shared/utils.ts` provides small reusable helpers:

- `delay(ms, jitter)`: Adds delay with optional jitter.
- `toAbsoluteUrl(url, base)`: Converts relative URLs to absolute URLs.
- `extractBackgroundImageUrl(el)`: Reads CSS `background-image` and extracts its URL.
- `extractImageUrl(el)`: Reads image URL from `src`, lazy attributes, or background image.
- `getRelativeSelector(root, child)`: Builds a selector from a selected product card to a child element.
- `getDomain(url)`: Converts a URL to a normalized hostname without `www.`.
- `cleanText(text)`: Collapses whitespace and trims.
- `parsePrice(text)`: Extracts a numeric value from price-like text.
- `generateId()`: Uses `crypto.randomUUID()`.
- `storageGet` and `storageSet`: Typed wrappers around `chrome.storage.local`.
- `sendToContentScript`: Wrapper around `chrome.tabs.sendMessage`.

## 10. Side Panel Application Flow

`src/sidepanel/App.tsx` composes the UI and uses two main hooks:

- `useScraper`
- `useTemplates`

When the app mounts, it detects pagination once by calling `scraper.detectPagination()`.

The UI has two broad phases:

### 10.1 Configuration Phase

Shown when status is `idle` or `selecting`.

Includes:

- Mode selector.
- Product card selection button for list mode.
- Template manager.
- Field mapper after a list selector exists.
- Pagination and page-limit controls after a list selector exists.
- Start scraping button.

### 10.2 Active or Complete Phase

Shown when status is `running`, `paused`, `complete`, or `error`.

Includes:

- Status bar.
- Live preview table.
- New scrape button.
- Export panel when scraping is complete and rows exist.
- Error panel when status is `error`.

## 11. Scraping Lifecycle

The core lifecycle is managed by `src/sidepanel/hooks/useScraper.ts`.

### 11.1 Initial State

Important state values:

- `session`: Current `ScrapeSession` or `null`.
- `isSelecting`: Whether page selection mode is active.
- `fields`: Current field mappings.
- `listSelector`: CSS selector for product card containers.
- `itemCount`: Number of matching product cards detected.
- `paginationInfo`: Detected pagination info.
- `maxPages`: Page scrape limit, default `10`.
- `delayMs`: Delay between pages, default `1500`.
- `rows`: Collected rows.
- `status`: Current session status.
- `error`: Error text if scraping fails.
- `mode`: Current scraper mode, default `list`.

Pause and stop state are stored in refs:

- `isPausedRef`
- `isStoppedRef`

This avoids stale values inside the async scrape loop.

### 11.2 Selecting Product Cards

When the user clicks **Select Elements**:

1. Side panel calls `startSelecting()`.
2. `useScraper` sends `ENABLE_SELECTOR` to the active tab.
3. Content script enables `SelectorEngine`.
4. User hovers over and clicks a product card.
5. `SelectorEngine` detects a repeated pattern.
6. Content script sends:
   - `ELEMENT_SELECTED`
   - `AUTO_FIELDS_DETECTED`
7. Side panel stores:
   - `listSelector`
   - `itemCount`
   - auto-detected `fields`
8. Side panel asks the content script to detect pagination.

### 11.3 Starting a Scrape

When the user clicks **Start Scraping**:

1. `startScraping()` validates that a list selector and fields exist.
2. Active tab URL and id are read.
3. A new `ScrapeSession` is created.
4. Status becomes `running`.
5. Rows are reset.
6. The scrape loop starts at page 1.

For each page:

1. If paused, wait in a loop.
2. Send `SCRAPE_PAGE` to the content script.
3. Content script extracts rows with `Extractor.extractAllRows`.
4. Append page rows to `allRows`.
5. Update React state and session progress.
6. Stop if max pages is reached or pagination type is `none`.
7. Wait using polite delay with jitter.
8. Move to the next page:
   - For infinite scroll: send `SCROLL_TO_BOTTOM`.
   - Otherwise: send `GO_NEXT_PAGE`.
9. Wait again for the next page or SPA render.
10. Increment page counter.

When the loop finishes, status becomes `complete`.

### 11.4 Pause, Resume, Stop, Reset

- `pause()`: Sets pause ref and status to `paused`.
- `resume()`: Clears pause ref and sets status to `running`.
- `stop()`: Sets stop ref and marks status as `complete`.
- `reset()`: Clears session, rows, selector, fields, item count, pagination info, error, pause, and stop flags.

## 12. Extension Messaging

The extension uses Chrome runtime and tab messaging.

### 12.1 Side Panel to Content Script

The side panel sends messages to the active tab with:

```ts
chrome.tabs.sendMessage(tab.id, { type, payload })
```

Handled content-script message types include:

- `PING`
- `ENABLE_SELECTOR`
- `DISABLE_SELECTOR`
- `SCRAPE_PAGE`
- `DETECT_PAGINATION`
- `GO_NEXT_PAGE`
- `SCROLL_TO_BOTTOM`
- `FETCH_IMAGE_BASE64`

### 12.2 Content Script to Side Panel

The content script sends runtime messages with:

```ts
chrome.runtime.sendMessage(message)
```

The service worker attaches the originating `tabId` and rebroadcasts messages so the side panel can receive them.

Important content-script-originating messages:

- `ELEMENT_SELECTED`
- `AUTO_FIELDS_DETECTED`

### 12.3 Async Responses

Content script handlers return `true` for async operations, such as:

- Going to the next page.
- Infinite scrolling.
- Fetching and converting images.

This keeps the Chrome message channel open until `sendResponse` is called.

## 13. Content Script Internals

### 13.1 Entry Point

`src/content/index.ts` creates one instance of each content-side service:

```ts
const selector = new SelectorEngine()
const extractor = new Extractor()
const paginator = new PaginationEngine()
const scrollHandler = new InfiniteScrollHandler()
```

It then registers a single message handler and delegates by message type.

### 13.2 Selector Engine

`src/content/selector.ts` provides interactive element selection.

Responsibilities:

- Enable and disable selection mode.
- Add mouseover, mouseout, and click listeners.
- Show a fixed overlay on hover.
- Prevent the selected page click from triggering normal site behavior.
- Detect repeating product-card-like patterns.
- Highlight detected matching elements.
- Generate a CSS selector for the selected group.

Pattern detection works by walking up the DOM tree from the clicked element. At each level, it looks for a parent with at least `MIN_REPEATING_ITEMS` children and tries to find siblings with the same tag and matching or overlapping classes.

If a repeated group is found, it returns:

- `listSelector`
- `count`
- clicked sample element
- all matching elements

If no repeated group is found, it falls back to selecting the clicked element alone.

Selector generation prefers:

1. Stable element id.
2. Tag plus up to two safe classes.
3. Anchor `href` prefix.
4. Tag name.

### 13.3 Extractor

`src/content/extractor.ts` handles field detection and row extraction.

Auto field detection checks:

- `img` elements for product images.
- CSS background images when no `img` is found.
- Common price selectors.
- Common name selectors.
- Anchor links for product URLs.

Row extraction:

1. Receives a container element and `FieldMapping[]`.
2. Resolves each field selector relative to the container.
3. Reads the configured attribute:
   - `text`
   - `href`
   - `src`
   - `background-image`
   - Any custom attribute.
4. Applies optional transform:
   - `trim`
   - `number`
   - `url-absolute`
   - `background-image-url`
5. Stores the value under the field label.

Batch extraction runs:

```ts
document.querySelectorAll(listSelector)
```

Then maps each container to one scraped row.

### 13.4 Pagination Engine

`src/content/paginator.ts` detects and advances pagination.

Detection order:

1. Element Plus / SPA indicators:
   - `ul.el-pager`
   - `button.btn-next`
2. Standard next button selectors.
3. Numbered pagination selectors.
4. Load more selectors.
5. Infinite scroll sentinels.
6. No pagination.

For `spa-next`, it clicks the next button and watches the probable product container with `MutationObserver`. If the DOM mutates, it resolves as successful. If no mutation is observed, it still resolves after `SPA_MUTATION_TIMEOUT_MS`.

For standard next and load-more pagination, it clicks a matching enabled element and waits briefly.

For infinite scroll, `PaginationEngine` returns `false` because the separate `InfiniteScrollHandler` owns that flow.

### 13.5 Infinite Scroll Handler

`src/content/infinite-scroll.ts` scrolls the page to the bottom and waits for new content.

It compares content counts before and after scrolling:

- If a container selector exists, it compares container child count.
- Otherwise, it falls back to product/item/goods-like elements.

If more content appears before timeout, it returns `true`. Otherwise, it returns `false`.

### 13.6 Image Fetching for Excel

For XLSX image embedding, the side panel cannot reliably use page credentials and CORS-sensitive resources directly. The content script handles `FETCH_IMAGE_BASE64`:

1. Fetch image URL from the page context.
2. Convert response to a blob.
3. Load blob into an `Image`.
4. Draw it to a canvas.
5. Resize to a thumbnail while preserving aspect ratio.
6. Convert to JPEG data URL.
7. Return base64 data to the side panel.

This helps ExcelJS embed images consistently and keeps the generated workbook smaller.

## 14. Template System

Templates are managed by `src/sidepanel/hooks/useTemplates.ts`.

Templates are stored per domain in `chrome.storage.local` under:

```ts
template_${domain}
```

When the active tab changes or completes loading:

1. Current tab URL is read.
2. Domain is normalized with `getDomain`.
3. Saved templates for that domain are loaded.
4. Built-in presets for that domain are merged first.
5. Matching templates are exposed to the UI.

### 14.1 Template Shape

Templates contain:

- `id`
- `name`
- `domain`
- `listSelector`
- `fields`
- `paginationType`
- Optional pagination selectors
- Delay setting
- Creation timestamp
- Optional `isPreset`

### 14.2 Built-in Preset

`src/shared/presets/mktoys.ts` defines `MKTOYS_TEMPLATE`.

This preset targets `mktoys.com` product listings and accounts for:

- Vue SPA behavior.
- Element Plus pagination.
- Product links under `/ProductInfo/`.
- Images that may use CSS background images.
- Prices that may require login.
- Pagination that updates DOM without changing URL.

It is exposed through:

```ts
export const BUILT_IN_PRESETS: SiteTemplate[] = [MKTOYS_TEMPLATE]
```

## 15. Export System

Exports are handled by `src/sidepanel/hooks/useExport.ts` and surfaced through `src/sidepanel/components/ExportPanel.tsx`.

### 15.1 CSV Export

CSV export:

1. Determines columns from selected fields.
2. Builds a comma-separated header row.
3. Quotes every cell value.
4. Escapes double quotes.
5. Creates a `Blob`.
6. Downloads it through `chrome.downloads.download`.

Image fields in CSV are exported as URLs.

### 15.2 XLSX Export

XLSX export uses ExcelJS:

1. Creates workbook.
2. Adds a `Products` worksheet.
3. Defines columns from selected fields.
4. Styles header row.
5. Adds scraped rows.
6. Applies row height and zebra striping.
7. Auto-fits non-image columns.
8. Optionally embeds product image thumbnails.
9. Writes workbook to an array buffer.
10. Downloads as `.xlsx`.

Image sizing constants:

- `THUMB_PX = 160`
- `CELL_HEIGHT_PT = 120`
- `CELL_WIDTH_CH = 22`
- `BATCH_SIZE = 8`

Images are fetched in small parallel batches to avoid overwhelming the active tab.

If image embedding fails for a row, the workbook falls back to a hyperlink labeled as a view-image link.

### 15.3 Bulk Image Download

Bulk image download:

1. Finds the image column and name column.
2. Sanitizes product names for filenames.
3. Downloads each image to a folder using `chrome.downloads.download`.
4. Waits briefly between downloads.

Images are saved with `.jpg` filenames regardless of the source URL format.

## 16. UI Components

### 16.1 `ModeSelector`

Displays three modes:

- List
- Click
- URL Batch

Only list mode has a complete user flow at present.

### 16.2 `TemplateManager`

Shows templates for the current domain, lets the user:

- Load a template.
- Delete user-created templates.
- Save the current selector and fields as a new template.

Preset templates are marked and cannot be deleted through the UI.

### 16.3 `FieldMapper`

Displays and edits field mappings.

Users can:

- Rename columns.
- Change field type.
- Change CSS selector.
- Choose attribute.
- Choose transform.
- Remove fields.
- Add custom fields.

### 16.4 `PaginationConfig`

Shows detected pagination type and lets the user configure:

- Maximum pages.
- Delay between pages.

The delay slider ranges from `500ms` to `5000ms`.

### 16.5 `StatusBar`

Shows scraping progress and controls:

- Running page progress.
- Row count.
- Pause.
- Resume.
- Stop.
- Error display.

### 16.6 `DataTable`

Previews scraped rows.

Characteristics:

- Displays field labels as columns.
- Uses 25-row preview pages.
- Caps preview pagination calculation at the first 100 rows.
- Links HTTP values.
- Truncates long cell values.

### 16.7 `ExportPanel`

Lets the user:

- Choose XLSX or CSV.
- Set filename.
- Include or exclude image column.
- Embed images in XLSX.
- Download images separately.
- Start export.

## 17. Styling System

The UI is a compact side-panel interface with a dark theme.

Core variables in `src/sidepanel/index.css`:

- `--panel-bg`
- `--panel-surface`
- `--panel-surface-2`
- `--panel-border`
- `--panel-text`
- `--panel-text-muted`
- `--brand`
- `--brand-dim`
- `--accent`
- `--danger`
- `--warning`

Reusable component classes include:

- `.panel-card`
- `.btn-primary`
- `.btn-secondary`
- `.btn-danger`
- `.btn-icon`
- `.input`
- `.input-label`
- `.mode-tab`
- `.section-title`
- `.field-row`
- `.badge`
- `.progress-track`
- `.progress-fill`
- `.data-table`
- `.toggle`
- `.pulse-dot`

The UI is optimized for a narrow Chrome side panel and sets `body` minimum width to `340px`.

## 18. End-to-End Data Flow

This is the normal list-mode scrape flow:

```text
User opens extension
  ↓
Chrome action opens side panel
  ↓
Side panel detects active tab pagination
  ↓
User clicks "Select Elements"
  ↓
Side panel sends ENABLE_SELECTOR to content script
  ↓
User clicks product card in webpage
  ↓
Content script detects repeated product card selector
  ↓
Content script auto-detects field mappings
  ↓
Content script sends selected selector and fields back
  ↓
Side panel displays fields and pagination controls
  ↓
User starts scraping
  ↓
Side panel sends SCRAPE_PAGE to content script
  ↓
Content script extracts rows from current DOM
  ↓
Side panel stores rows and updates preview
  ↓
Side panel asks content script to advance pagination
  ↓
Loop repeats until max pages, no next page, stop, or error
  ↓
Side panel marks session complete
  ↓
User exports CSV/XLSX/images
```

## 19. Message Reference

The `MessageType` union in `src/shared/types.ts` includes:

| Message | Direction | Purpose |
|---|---|---|
| `CONTENT_READY` | Content to extension | Declared but not actively used in current code |
| `ENABLE_SELECTOR` | Side panel to content | Start hover/click selection |
| `DISABLE_SELECTOR` | Side panel to content | Stop selection mode |
| `ELEMENT_SELECTED` | Content to side panel | Return detected list selector and count |
| `AUTO_FIELDS_DETECTED` | Content to side panel | Return auto-detected fields |
| `SCRAPE_PAGE` | Side panel to content | Extract rows from current page |
| `SCRAPE_PAGE_RESULT` | Content response | Return extracted rows |
| `GO_NEXT_PAGE` | Side panel to content | Advance to next page |
| `GO_NEXT_PAGE_RESULT` | Content response | Report whether navigation was triggered |
| `DETECT_PAGINATION` | Side panel to content | Detect current page pagination |
| `PAGINATION_DETECTED` | Content response | Return pagination information |
| `SCROLL_TO_BOTTOM` | Side panel to content | Trigger infinite scroll |
| `PROGRESS_UPDATE` | Declared | Not actively used in current code |
| `SCRAPE_COMPLETE` | Declared | Not actively used in current code |
| `FETCH_IMAGE_BASE64` | Side panel to content | Fetch and thumbnail image |
| `IMAGE_BASE64_RESULT` | Content response | Return image data |
| `ERROR` | Declared | Not actively used as a cross-component message |
| `PING` | Either | Connectivity check |
| `PONG` | Either | Connectivity response |

## 20. Current Limitations and Implementation Notes

### 20.1 List Mode Is the Main Implemented Mode

The UI includes `click` and `url-batch` modes, but there are no complete dedicated flows for them in `App.tsx` or `useScraper.ts`. They are currently future-facing UI options.

### 20.2 Session Persistence Is Limited

The project defines storage keys for sessions and settings, but the active scrape session is primarily held in React state. If the side panel closes or reloads mid-scrape, the current session is not fully restored.

### 20.3 Root `index.html` Appears Template-Like

There is a root-level `index.html` that references `/src/main.tsx`, but this project's actual side panel entry point is `src/sidepanel/index.html` and `src/sidepanel/main.tsx`. Because `vite.config.ts` uses the side panel HTML as the build input, the root file appears to be leftover Vite template scaffolding rather than the extension's runtime entry.

### 20.4 Selector Robustness Depends on Site Markup

The selector engine tries to build stable selectors, but heavily dynamic sites can still produce selectors that are too broad, too narrow, or unstable across pages. Field editing and templates are the intended escape hatch.

### 20.5 Content Script Must Be Present

If the active tab does not allow content scripts, or if the extension has not injected into the page yet, side panel messages can fail. `useScraper.sendToTab` catches these failures and returns `null`.

### 20.6 Image Embedding Depends on Fetch and Canvas

XLSX image embedding requires the content script to fetch the image and draw it to canvas. Some sites may block image fetches, require credentials, use anti-hotlinking, or taint canvas resources. The code falls back to image hyperlinks when base64 conversion fails.

### 20.7 Downloads Require Chrome Permission

CSV, XLSX, and image downloads all depend on the `downloads` permission declared in the manifest.

### 20.8 Infinite Scroll Detection Is Heuristic

Infinite scroll checks whether new content appears after scrolling. Sites with virtualization, delayed network responses, or non-product content mutations may need custom handling.

### 20.9 Pagination `totalPages` Is a Limit, Not Site Total

`ScrapeSession.totalPages` is set to the user-configured `maxPages`. The scraper does not currently calculate the site's true total page count.

## 21. Adding a New Built-in Preset

To add a preset:

1. Create or edit a file in `src/shared/presets/`.
2. Define a `SiteTemplate`.
3. Set:
   - `domain`
   - `listSelector`
   - `fields`
   - `paginationType`
   - Optional `nextButtonSelector`
   - Optional `spaPaginationContainerSelector`
   - `isPreset: true`
4. Export it through a presets array.
5. Import and merge it in `useTemplates.ts` or a central preset registry.

Example template shape:

```ts
export const EXAMPLE_TEMPLATE: SiteTemplate = {
  id: 'example-v1',
  name: 'Example Store',
  domain: 'example.com',
  listSelector: '.product-card',
  fields: [
    {
      id: 'example-name',
      label: 'Product Name',
      type: 'name',
      cssSelector: '.product-title',
      attribute: 'text',
      transform: 'trim',
    },
  ],
  paginationType: 'next-button',
  nextButtonSelector: 'a.next',
  delayBetweenPages: 1500,
  createdAt: new Date().toISOString(),
  isPreset: true,
}
```

## 22. Adding a New Field Type

To add a new field type:

1. Update `FieldType` in `src/shared/types.ts`.
2. Add it to `FIELD_TYPES` in `src/sidepanel/components/FieldMapper.tsx`.
3. Add a badge color in `TYPE_COLORS`.
4. Update extractor auto-detection if the field can be detected automatically.
5. Consider export behavior if it needs special handling.

## 23. Adding a New Attribute or Transform

For a new attribute:

1. Update `AttributeType` in `src/shared/types.ts` if it should be explicitly named.
2. Add it to the attribute select in `FieldMapper`.
3. Add extraction logic in `Extractor.extractFieldValue` if it needs custom behavior.

For a new transform:

1. Update `TransformType`.
2. Add it to the transform select in `FieldMapper`.
3. Implement it in `Extractor.extractFieldValue`.

## 24. Adding a New Pagination Strategy

To add another pagination strategy:

1. Add a new value to `PaginationType`.
2. Add a human-readable label to `PAGINATION_LABELS`.
3. Add detection logic in `PaginationEngine.detect()`.
4. Add navigation logic in `PaginationEngine.goToNextPage()`.
5. If the strategy needs UI configuration, update `PaginationConfig`.
6. Update templates if the strategy should be preset-compatible.

## 25. Development Workflow

Typical local workflow:

```bash
npm install
npm run dev
```

Then load the extension into Chrome from the Vite/CRX dev output as appropriate for the CRX plugin workflow.

Production build:

```bash
npm run build
```

Quality check:

```bash
npm run lint
```

Icon generation:

```bash
node generate-icons.cjs
```

Note: `generate-icons.cjs` currently writes simple placeholder PNG icon files from a base64 string.

## 26. Security, Privacy, and Site Behavior Considerations

Because the extension has `<all_urls>` host permissions and can inspect pages, it should be treated as a powerful browser extension.

Important considerations:

- Scraping should respect website terms and rate limits.
- The delay and jitter system helps avoid overly aggressive page traversal.
- Sensitive pages should not be scraped unintentionally.
- Exported data may contain private or logged-in user-visible product information.
- Templates are stored locally in Chrome storage.
- Image downloads and spreadsheets are saved to the user's machine through Chrome downloads.

## 27. Troubleshooting Guide

### Selection Does Nothing

Possible causes:

- Content script is not injected into the active tab.
- The active tab is a restricted Chrome page.
- The page has an overlay intercepting events.
- The side panel is targeting a different active tab than expected.

Useful code areas:

- `useScraper.startSelecting`
- `content/index.ts` handling `ENABLE_SELECTOR`
- `SelectorEngine.enable`

### Fields Are Empty

Possible causes:

- Field selectors are wrong relative to the product card.
- The list selector is selecting the wrong container.
- The target data is rendered after scraping starts.
- The field's configured attribute does not exist.

Useful code areas:

- `Extractor.resolveElement`
- `Extractor.extractFieldValue`
- `FieldMapper`

### Pagination Stops Too Early

Possible causes:

- Next button selector is not detected.
- Button is treated as disabled.
- SPA container does not mutate in the watched area.
- Infinite scroll timeout is too short.

Useful code areas:

- `PaginationEngine.detect`
- `PaginationEngine.clickSpaNext`
- `InfiniteScrollHandler.scrollAndWait`

### XLSX Exports Without Images

Possible causes:

- Image field is missing or excluded.
- Image URLs are not absolute HTTP URLs.
- Content script failed to fetch the image.
- Canvas conversion failed.
- Site blocks image requests.

Useful code areas:

- `ExportPanel`
- `useExport.exportXLSX`
- `embedImagesInExcelJSWorksheet`
- `content/index.ts` handling `FETCH_IMAGE_BASE64`

### Templates Do Not Show

Possible causes:

- Current domain does not match the template domain.
- Template was saved under a normalized domain without `www.`.
- Active tab URL is unavailable or restricted.

Useful code areas:

- `useTemplates.loadForDomain`
- `getDomain`
- `TemplateManager`

## 28. Suggested Future Improvements

Potential improvements visible from the current project structure:

- Implement full `click` mode workflow for manually selecting individual fields.
- Implement full `url-batch` mode workflow.
- Persist and restore active scrape sessions.
- Add stronger selector generation with unique path fallback.
- Add visible content-script connection status in the side panel.
- Add better per-page progress logs.
- Add duplicate row detection.
- Add user-editable pagination selectors in the UI.
- Add import/export for templates.
- Add validation warnings for empty selectors or duplicate field labels.
- Add tests for utility functions, extractor behavior, and pagination detection.
- Replace placeholder generated PNG icons with final branded icons.
- Remove or align the root `index.html` if it is no longer needed.

## 29. File-by-File Summary

### Root Files

- `manifest.json`: Chrome extension manifest.
- `package.json`: npm metadata, scripts, dependencies.
- `vite.config.ts`: Vite, React, CRX, and polyfill configuration.
- `tailwind.config.js`: Tailwind content paths, brand colors, fonts.
- `eslint.config.js`: ESLint flat config.
- `tsconfig.json`: Root TypeScript config.
- `tsconfig.app.json`: App TypeScript build config.
- `tsconfig.node.json`: Node-side TypeScript config for tooling.
- `generate-icons.cjs`: Creates placeholder PNG extension icons.
- `README.md`: Still contains default React/Vite template text.
- `index.html`: Appears to be leftover Vite template entry.

### Background

- `src/background/service-worker.ts`: MV3 service worker for side panel opening, message forwarding, and tab lifecycle state.

### Content

- `src/content/index.ts`: Content script entry and message router.
- `src/content/selector.ts`: Hover/click selector engine and repeated pattern detection.
- `src/content/extractor.ts`: Field auto-detection and row extraction.
- `src/content/paginator.ts`: Pagination detection and next-page handling.
- `src/content/infinite-scroll.ts`: Infinite scroll behavior.
- `src/content/messenger.ts`: Runtime message helper.

### Shared

- `src/shared/types.ts`: Shared TypeScript model definitions.
- `src/shared/constants.ts`: Constants, selector pools, labels, storage keys.
- `src/shared/utils.ts`: Shared helper functions.
- `src/shared/presets/mktoys.ts`: Built-in MK Toys preset.

### Side Panel

- `src/sidepanel/main.tsx`: React mount point.
- `src/sidepanel/App.tsx`: Top-level UI composition.
- `src/sidepanel/index.html`: Side panel HTML shell.
- `src/sidepanel/index.css`: Tailwind imports and custom component styles.
- `src/sidepanel/hooks/useScraper.ts`: Main scraper state machine and tab messaging.
- `src/sidepanel/hooks/useTemplates.ts`: Domain template loading and storage.
- `src/sidepanel/hooks/useExport.ts`: CSV, XLSX, image embedding, and image download logic.
- `src/sidepanel/components/ModeSelector.tsx`: Mode tabs.
- `src/sidepanel/components/TemplateManager.tsx`: Template list/load/save/delete UI.
- `src/sidepanel/components/FieldMapper.tsx`: Field editing UI.
- `src/sidepanel/components/PaginationConfig.tsx`: Pagination display and limits.
- `src/sidepanel/components/StatusBar.tsx`: Scraping status and controls.
- `src/sidepanel/components/DataTable.tsx`: Scraped data preview.
- `src/sidepanel/components/ExportPanel.tsx`: Export UI.

## 30. Mental Model for Maintaining This Project

The easiest way to reason about the project is:

```text
React side panel owns user state and workflow.
Content script owns page DOM operations.
Background worker connects extension lifecycle pieces.
Shared files define the contract between them.
```

When making changes, first decide which runtime area owns the behavior:

- UI state or user controls: side panel.
- DOM selection, extraction, pagination, image canvas work: content script.
- Extension lifecycle and cross-context routing: background service worker.
- Types, constants, presets, pure helpers: shared.

Keeping those boundaries clear will make future features much easier to add.
