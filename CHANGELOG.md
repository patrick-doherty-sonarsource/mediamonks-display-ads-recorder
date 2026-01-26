# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2025-08-11

### 🔥 BREAKING CHANGES
- **Migration from Puppeteer to Playwright**: Core browser automation engine has been replaced
- **Node.js compatibility**: Updated browser automation dependencies may require Node.js >= 16.x

### ✨ Added
- **Playwright Integration**: Replaced Puppeteer with Playwright v1.46.0 for improved browser automation
- **Enhanced Progress Tracking**: Real-time progress feedback during screenshot capture phase
- **Superior Video Quality**: Professional-grade video encoding with CRF 18 and 50Mbps bitrate
- **Optimized Browser Arguments**: Updated Chromium launch arguments for better Playwright compatibility

### 🚀 Improved
- **Performance**: Better browser instance management with Playwright's context isolation
- **Reliability**: More stable browser automation with Playwright's robust API
- **Video Output**: Enhanced FFmpeg settings for professional video quality:
  - CRF 18 (very high quality) constant rate factor
  - 50Mbps bitrate (increased from 10Mbps)
  - H.264 high profile for better compression
  - Web-optimized encoding with faststart
- **User Experience**: Frame-by-frame progress tracking during screenshot capture
- **Error Handling**: More robust browser launch and page navigation

### 🔄 Changed
- **Browser Engine**: Migrated from `puppeteer` to `playwright`
- **API Compatibility**: Updated browser automation calls to Playwright API:
  - `browser.newPage()` → `browser.newContext().newPage()`
  - `page.setViewport()` → `page.setViewportSize()`
  - `page.evaluateOnNewDocument()` → `page.addInitScript()`
- **Dependencies**: Updated package keywords from "puppeteer" to "playwright"

### 🛠️ Technical Details
- **Removed**: Puppeteer v19.2.2 dependency
- **Added**: Playwright v1.46.0 dependency
- **Browser Arguments**: Optimized Chromium flags for Playwright compatibility:
  - **Removed**: `--single-process` (not supported by Playwright's multi-process architecture)
  - **Enhanced**: `--disable-features=AudioServiceOutOfProcess,VizDisplayCompositor` (added VizDisplayCompositor for better rendering stability)
  - **Added**: `--disable-gpu` and `--disable-software-rasterizer` (improved headless rendering consistency)
- **Context Isolation**: Implemented proper browser context management
- **Progress Callbacks**: Added onProgress parameter to recording functions

### 📚 Documentation
- Updated README.md to reflect Playwright usage
- Added comprehensive migration changelog
- Updated code comments to reference Playwright instead of Puppeteer

### 🔧 Migration Guide
For users upgrading from v3.x to v4.x:

1. **No API Changes**: The public CLI interface remains unchanged
2. **Browser Dependencies**: Playwright will automatically download required browser binaries
3. **Performance**: Expect similar or improved performance with enhanced reliability
4. **Quality**: Video outputs will have significantly improved quality with new encoding settings

### 🏆 Benefits of Playwright Migration
- **Modern Browser Support**: Better support for latest browser features
- **Cross-Browser Testing**: Foundation for future multi-browser support
- **Active Development**: Playwright has more active development and community support
- **Better APIs**: More intuitive and powerful browser automation APIs
- **Improved Stability**: Better handling of modern web applications and dynamic content

---

## [3.4.0] - Previous Release
- Previous features and improvements...
