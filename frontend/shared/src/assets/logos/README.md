# Fundrbolt Logos

## Logo Variants

Fundrbolt has two primary logo variants designed for different background contexts:

### 1. Navy & Gold (for white/light backgrounds)
- **fundrbolt-logo-navy-gold.svg** - Vector logo with Navy (#11294c) and Gold (#ffc20e) colors
- **fundrbolt-logo-navy-gold.png** - Raster version for email templates (transparent background)
- **Use Case**: Landing pages, white cards, light-themed sections

### 2. White & Gold (for navy/dark backgrounds)
- **fundrbolt-logo-white-gold.svg** - Vector logo with White (#ffffff) and Gold (#ffc20e) colors
- **fundrbolt-logo-white-gold.png** - Raster version for email templates (transparent background)
- **Use Case**: Main app headers, navy backgrounds, dark-themed sections

## Quick Start

### Using the Shared Package

The easiest way to use logos is through the shared package:

```typescript
import { LogoNavyGold, LogoWhiteGold, getLogo } from '@fundrbolt/shared/assets';

// Direct usage
<img src={LogoNavyGold} alt="Fundrbolt" className="h-12" />

// Dynamic selection based on theme
const isDarkMode = true;
<img src={getLogo(isDarkMode ? 'dark' : 'light')} alt="Fundrbolt" className="h-12" />
```

### Web Applications
Use **SVG format** for best quality and performance:
```typescript
import { LogoNavyGold, LogoWhiteGold } from '@fundrbolt/shared/assets';

function Header({ isDarkBackground }: { isDarkBackground: boolean }) {
  return (
    <header className={isDarkBackground ? 'bg-brand-navy' : 'bg-white'}>
      <img
        src={isDarkBackground ? LogoWhiteGold : LogoNavyGold}
        alt="Fundrbolt"
        className="h-16 w-auto"
      />
    </header>
  );
}
```

### Email Templates
Use **PNG format** with transparent background:
```html
<!-- For dark header (navy background) -->
<img src="https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-white-gold.png"
     alt="Fundrbolt"
     style="height: 60px; display: block;" />

<!-- For light header (white background) -->
<img src="https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-navy-gold.png"
     alt="Fundrbolt"
     style="height: 60px; display: block;" />
```

## Variant Selection Guide

### Rule of Thumb
- **High contrast = Better visibility**
- Navy logo on white background = ✅ High contrast
- White logo on navy background = ✅ High contrast
- Navy logo on navy background = ❌ Low contrast (avoid)

### Visual Examples

```
┌─────────────────────────────────┐
│  WHITE BACKGROUND               │
│  [Navy & Gold Logo]             │ ← Use fundrbolt-logo-navy-gold.svg
│                                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│░░NAVY BACKGROUND░░░░░░░░░░░░░░░░│
│░░[White & Gold Logo]░░░░░░░░░░░░│ ← Use fundrbolt-logo-white-gold.svg
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────┘
```

## Designer Files

Original logo files from the designer are organized in subdirectories:

- **SVG/** - Vector source files (scalable, preferred for editing)
- **PNG/** - Raster exports in various sizes
- **PDF/** - Print-ready versions
- **JPEG/** - Compressed raster versions (avoid for web use)
- **Illustrator/** - Adobe Illustrator source files (.ai)

**Note**: Use the standardized files (fundrbolt-logo-navy-gold.svg, etc.) in your code. The designer files are for reference and re-export if needed.

## File Specifications

### SVG Files
- Format: Scalable Vector Graphics
- Size: ~5-15 KB
- Use: Web applications (preferred)
- Benefits: Infinite scaling, small file size, crisp on all displays

### PNG Files
- Format: Portable Network Graphics with transparency
- Dimensions: 500px wide minimum (maintains aspect ratio)
- Use: Email templates, legacy browsers, social media
- Benefits: Universal compatibility, transparent background

## Updating Logos

If the designer provides new logo files:

1. **Export from Designer Files**:
   - Export SVG from the Illustrator/ source files
   - Export PNG at 500px width minimum (or 2x size for retina: 1000px)
   - Ensure transparent backgrounds

2. **Optimize Files**:
   ```bash
   # Optimize SVG (remove metadata, compress)
   svgo fundrbolt-logo-navy-gold.svg

   # Optimize PNG (lossless compression)
   pngquant --quality=80-100 fundrbolt-logo-navy-gold.png
   ```

3. **Replace Files**:
   - Replace fundrbolt-logo-navy-gold.svg
   - Replace fundrbolt-logo-navy-gold.png
   - Replace fundrbolt-logo-white-gold.svg
   - Replace fundrbolt-logo-white-gold.png

4. **Verify Colors**:
   - Navy: #11294c
   - Gold: #ffc20e
   - White: #ffffff

5. **Test Across Apps**:
   ```bash
   # Rebuild all apps to pick up new logos
   cd frontend/fundrbolt-admin && pnpm build
   cd frontend/donor-pwa && pnpm build
   cd frontend/landing-site && pnpm build
   ```

6. **Update Email CDN**:
   - Upload new PNG files to Azure Blob Storage
   - Verify CDN URLs still work
   - Send test email to verify logo displays

## Brand Color Reference

| Color  | Hex Code  | Usage |
|--------|-----------|-------|
| Navy   | #11294c   | Primary brand color, backgrounds, Navy logo variant |
| Gold   | #ffc20e   | Secondary brand color, accents, emphasis |
| White  | #ffffff   | Text on dark backgrounds, White logo variant |
| Gray   | #58595b   | Secondary text, borders |

## Accessibility

Always include alt text when using logos:

```typescript
<img src={LogoNavyGold} alt="Fundrbolt - Fundraising platform" />
```

**Recommended alt text**:
- Simple: "Fundrbolt"
- Descriptive: "Fundrbolt - Fundraising platform"
- Context-aware: "Fundrbolt logo" (if context is clear)

## Troubleshooting

### Logo Not Displaying
1. Check import path: `import { LogoNavyGold } from '@fundrbolt/shared/assets';`
2. Verify Vite dev server is running
3. Clear browser cache
4. Check browser console for import errors

### Wrong Logo Variant
1. Verify background color: Navy background needs White logo
2. Check getLogo() parameter: `getLogo('dark')` for navy backgrounds
3. Use conditional logic based on theme

### Logo Blurry or Pixelated
1. Use SVG format instead of PNG for web
2. Ensure PNG is at least 500px wide (1000px for retina)
3. Use `width="auto" height="60px"` to maintain aspect ratio

## File Inventory

✅ **Standardized Files** (use these in code):
- fundrbolt-logo-navy-gold.svg
- fundrbolt-logo-navy-gold.png
- fundrbolt-logo-white-gold.svg
- fundrbolt-logo-white-gold.png

📁 **Designer Files** (for reference):
- SVG/*.svg
- PNG/*.png
- PDF/*.pdf
- JPEG/*.jpg
- Illustrator/*.ai
- FundrBolt-Logo-Package.ai

## Support

For logo questions or requests:
- Design Team: Check with designer for new variants
- Development Team: See [INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md)
- Brand Guidelines: (to be created)
