# PDF Viewer Pro

A fast and reliable PDF viewer for VS Code with advanced navigation and zoom controls.

## ✨ Features

- **🚀 Fast PDF Rendering** - Opens PDFs instantly with smooth performance
- **📄 Multi-page Navigation** - Easy page-by-page browsing with arrow keys or buttons  
- **🔍 Precision Zoom** - 10% increments from 10% to 500%, default 70%
- **📸 Smart Image Export** - PNG or JPEG with quality control, optimized for AI
- **🎨 VS Code Integration** - Matches your editor theme and interface
- **⌨️ Keyboard Shortcuts** - Navigate without taking hands off keyboard
- **🎯 Smart Layout** - Zoom controls, image export, and page navigation

## 🚀 Getting Started

### Automatic Opening
PDF Viewer Pro automatically becomes the default PDF viewer in VS Code. Just **click any PDF file** and it opens instantly!

### Manual Opening
- **Command Palette**: `Ctrl+Shift+P` → "PDF Viewer Pro: Open PDF File"
- **Right-click**: Any `.pdf` file → "Open with PDF Viewer Pro"  
- **Editor Tab**: Click the editor dropdown → Choose "PDF Viewer Pro"

## 🎮 Controls

### Toolbar
- **Zoom Controls**: `[-] 70% [+]` - Decrease/increase by 10%
- **Image Export**: `[Create Image]` `[Create Image All Pages]` - Export with format options
- **Format Selection**: `[JPEG ▼]` `[75% ▼]` - Choose format and quality
- **Page Navigation**: `[←] Page 1 of 3 [→]` - Browse pages

### Keyboard Shortcuts
- **`←` `PageUp`** - Previous page
- **`→` `PageDown`** - Next page
- **`+` `=`** - Zoom in
- **`-`** - Zoom out

### Image Export
- **Format Options**: PNG (lossless) or JPEG (compressed)
- **JPEG Quality**: 70%-100% in 5% steps, default 75% (AI-optimized)
- **Smart UI**: Quality selector auto-hides for PNG
- **Persistent Settings**: Remembers format choice across files
- **Single Export**: `filename.pdf.page01.png` or `.jpg`
- **Batch Export**: All pages as sequential numbered files
- **Save Location**: Same directory as PDF file

### 🤖 AI-Optimized Export
- **75% JPEG**: 30-40% smaller files, excellent AI readability
- **Token Efficient**: Reduces cost for AI processing by ~40%
- **Quality Balance**: Perfect for OCR, document analysis, and AI vision

### Mouse
- **Click Buttons** - Navigate, zoom, and export images

## 📋 System Requirements

- **VS Code**: Version 1.85.0 or higher
- **Platform**: Works on Windows, macOS, and Linux
- **Internet**: Required for initial PDF.js library download

## 🔧 Technical Features

- **PDF.js Rendering** - Uses the same engine as Firefox and Chrome
- **Canvas-based Display** - Smooth, high-quality rendering at any zoom level
- **Smart Caching** - Keeps frequently used pages in memory
- **Advanced Image Export** - PNG/JPEG with quality control and AI optimization
- **Lightweight** - Only 547KB download size
- **No Dependencies** - PDF.js loads from CDN, no local install needed

## 🆘 Troubleshooting

### PDF Not Loading?
1. Check the developer console (`Help` → `Toggle Developer Tools`)
2. Look for "PDF.js loaded successfully" message
3. Verify internet connection for PDF.js CDN download

### Navigation Not Working?
- Try keyboard shortcuts (`←` `→`) as alternative
- Check console for "Next page clicked" debug messages
- Ensure PDF has multiple pages

### Display Issues?
- Try zooming in/out to refresh the display (10% increments)
- Restart VS Code if PDF appears corrupted
- Check zoom level is between 10% and 500%

### Image Export Issues?
- Ensure PDF is fully loaded before exporting
- Check file permissions in the PDF directory  
- Large PDFs may take time for "Create Image All Pages"
- PNG export always uses 100% quality (lossless)
- JPEG quality selector only appears for JPEG format

## 📝 Feedback & Support

Found a bug or have a suggestion? Please report issues with:
- PDF file details (size, number of pages)
- VS Code version
- Console error messages (if any)

Enjoy fast, reliable PDF viewing in VS Code! 📖