# EcomScraper

Point-and-click product scraper for e-commerce sites as a Chrome Extension. Extracts names, prices, and images across pages, and exports data to CSV and Excel.

## Features

- **Point-and-Click Interface**: Easily select elements on the page to extract data.
- **Data Extraction**: Extract product names, prices, images, and other relevant information.
- **Export Options**: Export extracted data to CSV and Excel formats.
- **Chrome Extension**: Accessible directly from your browser as a Side Panel extension.

## Development

This project is built using:
- React
- TypeScript
- Vite
- Tailwind CSS

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the extension:
   ```bash
   npm run build
   ```
3. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory.
