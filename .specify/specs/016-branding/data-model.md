# Phase 1: Data Model - Centralized Brand Assets and Theme System

**Date**: 2026-01-19  
**Feature**: 016-branding

## Data Model Overview

This document defines the data structures for brand asset management. Note: This is primarily a **frontend-only feature** with static assets (no database tables). The only backend integration is updating email service configuration to reference Azure CDN URLs.

---

## Entity 1: Logo Asset

**Description**: Logo file variants for different background contexts

**Storage Location**: 
- Frontend: `frontend/shared/src/assets/logos/`
- Email: Azure Blob Storage (`branding` container)

**Properties**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | Yes | Enum: `"navy-gold"`, `"white-gold"` | Logo variant identifier |
| `background` | string | Yes | Enum: `"light"`, `"dark"` | Intended background context |
| `svgPath` | string | Yes | Absolute path or URL | SVG file location (preferred for web) |
| `pngPath` | string | Yes | Absolute path or URL | PNG file location (for email, legacy browsers) |
| `width` | number | No | Min: 100, Max: 1000 | Recommended display width in pixels |
| `height` | number | No | Min: 50, Max: 500 | Recommended display height in pixels |
| `altText` | string | Yes | Max: 100 chars | Accessibility text |

**Relationships**: None (static assets)

**TypeScript Interface**:
```typescript
// frontend/shared/src/assets/types.ts
export interface LogoAsset {
  name: 'navy-gold' | 'white-gold';
  background: 'light' | 'dark';
  svgPath: string;
  pngPath: string;
  width?: number;
  height?: number;
  altText: string;
}

export const logoAssets: LogoAsset[] = [
  {
    name: 'navy-gold',
    background: 'light',
    svgPath: '/src/assets/logos/fundrbolt-logo-navy-gold.svg',
    pngPath: '/src/assets/logos/fundrbolt-logo-navy-gold.png',
    altText: 'Fundrbolt - Navy and Gold Logo',
  },
  {
    name: 'white-gold',
    background: 'dark',
    svgPath: '/src/assets/logos/fundrbolt-logo-white-gold.svg',
    pngPath: '/src/assets/logos/fundrbolt-logo-white-gold.png',
    altText: 'Fundrbolt - White and Gold Logo',
  },
];
```

**File Naming Convention**:
- Pattern: `fundrbolt-logo-{color1}-{color2}.{ext}`
- Examples: `fundrbolt-logo-navy-gold.svg`, `fundrbolt-logo-white-gold.png`

**Azure CDN URLs** (for email):
- `https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-navy-gold.png`
- `https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-white-gold.png`

---

## Entity 2: Theme Configuration

**Description**: Brand color palette and typography settings

**Storage Location**: `frontend/shared/src/assets/themes/colors.ts`

**Properties**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `primary.navy` | string | Yes | Hex color: `#11294c` | Primary brand color (dark blue) |
| `primary.gold` | string | Yes | Hex color: `#ffc20e` | Secondary brand color (gold) |
| `neutral.white` | string | Yes | Hex color: `#ffffff` | White (text on dark backgrounds) |
| `neutral.gray` | string | Yes | Hex color: `#58595b` | Gray (secondary text, borders) |
| `cssVariables` | object | Yes | Key-value pairs | CSS custom properties for inline styles |
| `fontFamily` | string | Yes | CSS font-family value | System font stack |

**Relationships**: None (constants)

**TypeScript Type Definition**:
```typescript
// frontend/shared/src/assets/themes/colors.ts
export const colors = {
  primary: {
    navy: '#11294c' as const,
    gold: '#ffc20e' as const,
  },
  neutral: {
    white: '#ffffff' as const,
    gray: '#58595b' as const,
  },
  cssVariables: {
    '--color-primary-navy': '#11294c',
    '--color-primary-gold': '#ffc20e',
    '--color-neutral-white': '#ffffff',
    '--color-neutral-gray': '#58595b',
  },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' as const,
} as const;

export type BrandColors = typeof colors;
```

**Usage Examples**:
```typescript
// TypeScript component
import { colors } from '@fundrbolt/shared/assets';

const buttonStyle = {
  backgroundColor: colors.primary.navy,
  color: colors.neutral.white,
  fontFamily: colors.fontFamily,
};

// Tailwind CSS config
export default {
  theme: {
    extend: {
      colors: {
        'brand-navy': '#11294c',
        'brand-gold': '#ffc20e',
      },
    },
  },
};

// Inline HTML (for emails)
<span style="color: #11294c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  Your ticket is confirmed!
</span>
```

---

## Entity 3: Favicon Set

**Description**: Collection of favicon files for browser/mobile display

**Storage Location**: Each app's `public/` directory
- `frontend/fundrbolt-admin/public/`
- `frontend/donor-pwa/public/`
- `frontend/landing-site/public/`

**Properties**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `size16` | string | Yes | Filename: `favicon-16.png` | 16x16 PNG for browser tabs |
| `size32` | string | Yes | Filename: `favicon-32.png` | 32x32 PNG for bookmarks |
| `size180` | string | Yes | Filename: `apple-touch-icon.png` | 180x180 PNG for iOS home screen |
| `size192` | string | Yes | Filename: `favicon-192.png` | 192x192 PNG for Android home screen |
| `size512` | string | Yes | Filename: `favicon-512.png` | 512x512 PNG for high-res displays |
| `ico` | string | Yes | Filename: `favicon.ico` | Multi-size ICO (32x32 + 16x16 embedded) |
| `svg` | string | Yes | Filename: `favicon.svg` | Scalable SVG for modern browsers |

**Relationships**: None (static files)

**File Structure**:
```
public/
├── favicon.ico              # Legacy IE support, 32x32 with 16x16 embedded
├── favicon.svg              # Modern browsers, scalable
├── favicon-16.png           # Browser tabs
├── favicon-32.png           # Bookmarks, Windows taskbar
├── apple-touch-icon.png     # iOS home screen (180x180)
├── favicon-192.png          # Android home screen
└── favicon-512.png          # Android high-res, PWA splash
```

**HTML Integration** (in `index.html` `<head>`):
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png">
```

**Generation Script** (already exists):
- Location: `frontend/shared/src/assets/favicons/generate-favicons.js`
- Usage: `node generate-favicons.js` (copies files to all app public/ dirs)

---

## Entity 4: Email Template Logo Reference

**Description**: Configuration for email service to reference CDN-hosted logos

**Storage Location**: `backend/app/services/email_service.py`

**Properties**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `logoUrl` | string | Yes | HTTPS URL | Azure CDN URL for logo image |
| `altText` | string | Yes | Max: 100 chars | Accessibility text |
| `height` | string | Yes | CSS value (e.g., "60px") | Display height in email |
| `width` | string | No | CSS value (e.g., "200px") | Display width (optional, maintains aspect ratio) |

**Current Implementation** (to be updated):
```python
# backend/app/services/email_service.py
class EmailService:
    def _get_logo_url(self, background: str = "dark") -> str:
        """Get Azure CDN logo URL for email templates"""
        base_url = "https://fundrbolt-branding.azureedge.net/logos"
        
        if background == "dark":
            return f"{base_url}/fundrbolt-logo-white-gold.png"
        else:
            return f"{base_url}/fundrbolt-logo-navy-gold.png"
    
    def _render_email_template(self, template_name: str, context: dict) -> str:
        """Render email template with logo URL"""
        context["logo_url"] = self._get_logo_url()
        context["logo_alt"] = "Fundrbolt"
        # ... rest of template rendering
```

**Email HTML Usage**:
```html
<!-- backend/app/templates/emails/base.html -->
<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #11294c;">
  <tr>
    <td align="center" style="padding: 20px 0;">
      <img src="{{ logo_url }}" 
           alt="{{ logo_alt }}" 
           style="height: 60px; display: block;" />
    </td>
  </tr>
</table>
```

**Environment Variables** (optional):
```bash
# .env
AZURE_CDN_LOGO_BASE_URL=https://fundrbolt-branding.azureedge.net/logos
```

---

## Data Model Summary

| Entity | Storage | Format | Relationships |
|--------|---------|--------|---------------|
| **Logo Asset** | Filesystem + Azure Blob | SVG, PNG | None |
| **Theme Configuration** | TypeScript constants | Object literal | None |
| **Favicon Set** | Public directories | ICO, SVG, PNG (7 files) | None |
| **Email Template Reference** | Python config | String (URL) | None |

**No Database Tables Required**: All entities are static assets or configuration constants.

**Ready for Phase 1: Contracts**
