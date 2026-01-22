# Fundrbolt Favicons

**STATUS**: Favicon HTML links updated in all 3 frontend apps. Awaiting favicon file generation from design team.

## Overview

Fundrbolt uses a comprehensive favicon setup to ensure brand consistency across all browsers, devices, and platforms. Each app includes 7 favicon variants for optimal display across different contexts.

## Required Favicon Files

### 1. Legacy Browser Support
- **favicon.ico** (16x16, 32x32, 48x48 multi-size) - IE and legacy browsers

### 2. Modern Browsers
- **favicon.svg** - Scalable vector for modern browsers (best quality at any size)

### 3. Standard PNG Sizes
- **icon-16x16.png** (16x16) - Browser tabs (tiny icon)
- **icon-32x32.png** (32x32) - Windows taskbar, bookmarks
- **icon-192x192.png** (192x192) - Android Chrome add-to-home-screen, PWA
- **icon-512x512.png** (512x512) - Android high-res, PWA splash screens

### 4. Apple Devices
- **apple-touch-icon.png** (180x180) - iOS home screen icon (opaque background required)

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

All 3 frontend apps now include comprehensive favicon links in their `index.html` files:

### fundrbolt-admin & donor-pwa

```html
<head>
  <!-- Favicons - Comprehensive cross-platform support -->
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
  <link rel="icon" type="image/png" sizes="16x16" href="/images/icon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/images/icon-32x32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/images/icon-192x192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/images/icon-512x512.png" />
</head>
```

### landing-site

```html
<head>
  <!-- Favicons - Comprehensive cross-platform support -->
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="icon" type="image/png" sizes="16x16" href="/icon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icon-32x32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />
</head>
```

**Note**: landing-site uses `/icon.svg` instead of `/images/favicon.svg` due to different public directory structure.

## Web App Manifest (PWA)

For Progressive Web Apps, update `manifest.json` with icon references:

```json
{
  "icons": [
    {
      "src": "/images/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/images/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

## Favicon Regeneration Process

When the design team provides updated logo assets, follow these steps:

### Prerequisites
- Source logo files (SVG or high-resolution PNG, minimum 512x512)
- Design software or online favicon generator
- Recommended tool: [RealFaviconGenerator](https://realfavicongenerator.net/)

### Step 1: Generate Files

#### Option A: RealFaviconGenerator (Recommended)
1. Go to https://realfavicongenerator.net/
2. Upload your 512x512 logo source file
3. Configure platform settings:
   - **Desktop/Android**: Full logo, no background
   - **iOS**: Navy background (#11294c), no margin
   - **Android Chrome**: Navy background (#11294c)
4. Download generated package and rename files to match our naming convention

#### Option B: Manual Export
1. Use design software to export at exact sizes (16, 32, 180, 192, 512)
2. Create multi-size ICO with ImageMagick:
   ```bash
   convert icon-16x16.png icon-32x32.png icon-48x48.png favicon.ico
   ```
3. For `apple-touch-icon.png`: Use opaque Navy background (#11294c)

### Step 2: File Locations

Deploy generated files to each app's public directory:

```
frontend/
  fundrbolt-admin/public/
    favicon.ico
    images/
      favicon.svg
      icon-16x16.png
      icon-32x32.png
      icon-192x192.png
      icon-512x512.png
      apple-touch-icon.png
      
  donor-pwa/public/
    favicon.ico
    images/
      [same files as admin]
      
  landing-site/public/
    favicon.ico
    icon.svg              # Note: different naming
    icon-16x16.png
    icon-32x32.png
    icon-192x192.png
    icon-512x512.png
    apple-touch-icon.png
```

### Step 3: Optimize Files

```bash
# Optimize PNG files (requires optipng)
optipng -o7 *.png

# Optimize SVG files (requires svgo)
svgo favicon.svg --multipass

# Verify file sizes (target < 50KB each)
ls -lh *.png *.svg *.ico
```

### Step 4: Test

After deployment, test across browsers:

1. **Desktop**: Chrome, Firefox, Safari, Edge (tab icons, bookmarks)
2. **iOS**: Add landing-site to home screen, verify Apple Touch Icon
3. **Android**: Add donor-pwa to home screen, verify icon clarity
4. **Cache clearing**: Hard refresh (Ctrl+Shift+R) if old icons persist

### Troubleshooting

- **Icon not updating**: Clear browser cache with Ctrl+Shift+R
- **iOS icon issues**: Ensure apple-touch-icon.png has opaque background (no transparency)
- **Android blurry**: Verify icon-512x512.png is high resolution
- **PWA cache**: Unregister service worker and clear PWA cache

## Design Guidelines

- **Simplicity**: Favicons appear at 16x16. Use simplified logo or "F" mark if needed
- **Legibility**: Ensure recognizable at smallest size
- **Color Contrast**: Use Navy (#11294c) + Gold (#ffc20e) for visibility
- **Transparency**: Transparent background for most icons except Apple Touch Icon
- **iOS Apple Touch Icon**: Opaque Navy background, no rounded corners (iOS applies automatically)
