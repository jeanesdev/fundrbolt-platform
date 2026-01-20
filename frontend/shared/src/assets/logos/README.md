# Fundrbolt Logos

**⚠️ PLACEHOLDER FILES - Replace with actual logo files from designer**

## Logo Variants

### 1. Navy & Gold (for white/light backgrounds)
- **fundrbolt-logo-navy-gold.svg** - Vector logo with Navy (#11294c) and Gold (#ffc20e) colors
- **fundrbolt-logo-navy-gold.png** - Raster version for email templates (transparent background)

### 2. White & Gold (for navy/dark backgrounds)
- **fundrbolt-logo-white-gold.svg** - Vector logo with White (#ffffff) and Gold (#ffc20e) colors
- **fundrbolt-logo-white-gold.png** - Raster version for email templates (transparent background)

## Usage Guidelines

### Web Applications
Use **SVG format** for best quality and performance:
```typescript
import LogoNavyGold from '@fundrbolt/shared/assets/logos/fundrbolt-logo-navy-gold.svg';
import LogoWhiteGold from '@fundrbolt/shared/assets/logos/fundrbolt-logo-white-gold.svg';
```

### Email Templates
Use **PNG format** with transparent background:
```html
<img src="https://your-cdn.com/fundrbolt-logo-white-gold.png" alt="Fundrbolt" />
```

### Background Color Selection
- **White/Light backgrounds** → Use `fundrbolt-logo-navy-gold.*`
- **Navy/Dark backgrounds** → Use `fundrbolt-logo-white-gold.*`

## File Requirements

When replacing placeholder files, ensure:
- SVG files are optimized (remove unnecessary metadata)
- PNG files have transparent backgrounds
- PNG dimensions: Minimum 500px wide for high-DPI displays
- All files maintain consistent aspect ratios
- Colors match brand specifications exactly:
  - Navy: #11294c
  - Gold: #ffc20e
  - White: #ffffff
