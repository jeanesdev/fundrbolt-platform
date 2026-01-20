# Fundrbolt Favicons

**⚠️ PLACEHOLDER FILES - Generate actual favicon files from designer's logo**

## Required Favicon Files

### 1. Legacy Browser Support
- **favicon.ico** (32x32 with embedded 16x16) - Multi-size ICO for IE and legacy browsers

### 2. Modern Browsers (PNG)
- **favicon-16.png** (16x16) - Browser tabs (tiny icon)
- **favicon-32.png** (32x32) - Windows taskbar, bookmarks
- **favicon-192.png** (192x192) - Android Chrome add-to-home-screen
- **favicon-512.png** (512x512) - Android high-res, PWA splash screens

### 3. Apple Devices
- **apple-touch-icon.png** (180x180) - iOS home screen icon

### 4. Progressive Enhancement
- **favicon.svg** - Scalable vector for modern browsers (best quality at any size)

## Design Considerations

⚠️ **Important**: Favicons are displayed at very small sizes (16x16px). The full logo may not be recognizable at this size.

**Recommendations**:
- Use a simplified icon or symbol from your logo
- Consider using just a stylized "F" mark
- Ensure the icon is recognizable at 16x16px
- Use high contrast colors (Navy #11294c and Gold #ffc20e)
- Avoid fine details that won't be visible at small sizes

## Generation Tools

You can use these tools to generate favicons from your logo:
- [Favicon.io](https://favicon.io/) - Generate favicons from images
- [RealFaviconGenerator](https://realfavicongenerator.net/) - Comprehensive favicon generator
- Adobe Illustrator/Photoshop - Manual export at specific sizes

## HTML Integration

Add to `<head>` section of all frontend apps:
```html
<!-- Modern browsers -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">

<!-- Legacy browsers -->
<link rel="shortcut icon" href="/favicon.ico">

<!-- Apple devices -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<!-- Android Chrome -->
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png">
```

## Web App Manifest (PWA)

For Progressive Web Apps, add to `manifest.json`:
```json
{
  "icons": [
    {
      "src": "/favicon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/favicon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```
