# Phase 0: Research - Centralized Brand Assets and Theme System

**Date**: 2026-01-19  
**Feature**: 016-branding

## Research Overview

This document consolidates research findings for implementing centralized brand asset management and theme configuration across three frontend applications.

---

## R1: System Font Stack Configuration

**Decision**: Use modern system font stack with cross-platform fallbacks

**Rationale**:
- Zero external dependencies (no web font loading, no licensing)
- Instant rendering (no FOUT/FOIT flash of unstyled text)
- Excellent cross-platform consistency across Windows, macOS, iOS, Android
- Professional appearance using OS-native fonts optimized for each platform
- Proven pattern used by GitHub, Bootstrap, Tailwind CSS

**Font Stack**:
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Breakdown**:
- `-apple-system`: San Francisco on macOS/iOS (Apple's system font)
- `BlinkMacSystemFont`: San Francisco on older Chrome for macOS
- `"Segoe UI"`: Windows system font (clean, professional)
- `Roboto`: Android system font
- `"Helvetica Neue"`: macOS fallback for older versions
- `Arial`: Universal fallback (everywhere)
- `sans-serif`: Generic fallback

**Alternatives Considered**:
- Custom web fonts (Google Fonts, Typekit): Rejected due to loading overhead, licensing complexity, GDPR cookie requirements for external font loading
- Single font (Arial only): Rejected as less polished on modern platforms; doesn't leverage better OS fonts
- Defer to application teams: Rejected to maintain brand consistency

**References**:
- [System Font Stack - CSS Tricks](https://css-tricks.com/snippets/css/system-font-stack/)
- [Tailwind CSS Default Fonts](https://tailwindcss.com/docs/font-family)

---

## R2: Azure Blob Storage CDN for Email Logo Hosting

**Decision**: Host email logos on Azure Blob Storage with CDN endpoint and public read access

**Rationale**:
- **Reliability**: 99.9% SLA from Azure, separate from application server uptime
- **Performance**: Global CDN edge caching ensures fast delivery to email clients worldwide
- **Cost-effective**: Blob storage is $0.018/GB/month, CDN bandwidth $0.081/GB (first 10TB)
- **Email client compatibility**: Public HTTPS URLs work across all email clients (Gmail, Outlook, Apple Mail, Yahoo)
- **Operational simplicity**: No application server dependency for serving static assets
- **Existing infrastructure**: Azure Blob Storage already in use for event images and sponsor content

**Configuration**:
- Storage Account: `fundrboltstorage` (or create dedicated branding account)
- Container: `branding` with public blob access level
- CDN Profile: Azure CDN Standard from Microsoft
- CDN Endpoint: `https://fundrbolt-branding.azureedge.net/logos/`
- Files: `fundrbolt-logo-navy-gold.png`, `fundrbolt-logo-white-gold.png`

**Email Template Usage**:
```html
<img src="https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-white-gold.png" 
     alt="Fundrbolt" 
     style="height: 60px;" />
```

**Alternatives Considered**:
- Application web servers: Rejected due to coupling with app uptime, no CDN benefit, requires load balancer configuration
- Embedded base64 data URIs: Rejected due to large email sizes (increases spam score), some clients block data URIs, harder to update logos
- Third-party CDN (Cloudflare, Fastly): Rejected to minimize vendor sprawl; Azure CDN integrates seamlessly with existing infrastructure

**Azure Bicep Implementation**:
```bicep
resource blobStorage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: 'fundrboltstorage'
}

resource brandingContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobStorage
  name: 'branding'
  properties: {
    publicAccess: 'Blob'
  }
}

resource cdnProfile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: 'fundrbolt-cdn'
  location: 'global'
  sku: {
    name: 'Standard_Microsoft'
  }
}

resource cdnEndpoint 'Microsoft.Cdn/profiles/endpoints@2023-05-01' = {
  parent: cdnProfile
  name: 'fundrbolt-branding'
  location: 'global'
  properties: {
    originHostHeader: '${blobStorage.name}.blob.core.windows.net'
    origins: [
      {
        name: 'blob-origin'
        properties: {
          hostName: '${blobStorage.name}.blob.core.windows.net'
        }
      }
    ]
  }
}
```

**References**:
- [Azure Blob Storage Pricing](https://azure.microsoft.com/en-us/pricing/details/storage/blobs/)
- [Azure CDN Documentation](https://learn.microsoft.com/en-us/azure/cdn/)
- [Email Client Image Support](https://www.caniemail.com/features/html-img/)

---

## R3: ESLint Enforcement with Pre-commit Hooks

**Decision**: Configure ESLint rules as warnings with pre-commit hook enforcement

**Rationale**:
- **Developer-friendly during development**: Warnings don't break hot module reload or dev server
- **Educational approach**: Developers see warnings immediately and learn best practices
- **Strict at commit boundary**: Pre-commit hooks block commits with violations, ensuring clean code enters repository
- **Balanced workflow**: Allows rapid iteration during development while maintaining code quality standards
- **Industry standard pattern**: Used by Airbnb, Google, Meta frontend teams

**ESLint Configuration**:
```javascript
// .eslintrc.js (or .eslintrc.json)
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'warn',  // Warning level during development
      {
        selector: 'Literal[value=/#[0-9a-f]{3,8}/i]',
        message: 'Do not hardcode hex colors. Import from @fundrbolt/shared/assets/themes/colors instead.',
      },
      {
        selector: 'Literal[value=/rgb\\(/i]',
        message: 'Do not hardcode RGB colors. Import from @fundrbolt/shared/assets/themes/colors instead.',
      },
      {
        selector: 'Literal[value=/hsl\\(/i]',
        message: 'Do not hardcode HSL colors. Import from @fundrbolt/shared/assets/themes/colors instead.',
      },
    ],
  },
};
```

**Pre-commit Hook (.husky/pre-commit)**:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run ESLint on staged files
npx lint-staged
```

**Lint-staged Configuration (package.json)**:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings 0"  // Fail on any warnings during commit
    ]
  }
}
```

**Installation**:
```bash
pnpm add -D husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

**Alternatives Considered**:
- ESLint errors (immediate build break): Rejected as too disruptive to developer workflow; breaks fast feedback loop
- Warnings only (no enforcement): Rejected as violations would accumulate; no guarantee of clean commits
- CI-only enforcement: Rejected as too late in feedback cycle; wastes PR review time

**Developer Experience**:
1. **During development**: See warning in IDE/terminal → "Warning: Do not hardcode hex colors"
2. **On save**: Auto-fix if possible, otherwise warning persists
3. **On commit attempt**: Pre-commit hook fails → "Fix ESLint warnings before committing"
4. **After fix**: Commit succeeds

**Exemptions**:
Theme colors.ts file itself needs exemption:
```javascript
// frontend/shared/src/assets/themes/colors.ts
/* eslint-disable no-restricted-syntax */
export const colors = {
  primary: {
    navy: '#11294c',
    gold: '#ffc20e',
  },
  // ... rest of colors
};
/* eslint-enable no-restricted-syntax */
```

**References**:
- [ESLint no-restricted-syntax](https://eslint.org/docs/latest/rules/no-restricted-syntax)
- [Husky Git Hooks](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)

---

## R4: Vite Asset Handling Best Practices

**Decision**: Use Vite's built-in asset imports with `?url` suffix for explicit URLs

**Rationale**:
- **Type-safe imports**: TypeScript sees asset imports as strings (URL paths)
- **Build-time optimization**: Vite processes assets during build (optimization, hashing, CDN prep)
- **Explicit URL handling**: `?url` suffix returns asset URL as string (vs default inlined/base64 for small assets)
- **Hot module reload support**: Asset changes trigger HMR without full page reload
- **Production-ready**: Automatic fingerprinting (e.g., `logo.abc123.svg`) for cache busting

**Implementation**:
```typescript
// frontend/shared/src/assets/index.ts
import LogoNavyGoldSvg from './logos/fundrbolt-logo-navy-gold.svg?url';
import LogoWhiteGoldSvg from './logos/fundrbolt-logo-white-gold.svg?url';

export { LogoNavyGoldSvg as LogoNavyGold, LogoWhiteGoldSvg as LogoWhiteGold };
```

**Type Declarations** (vite-env.d.ts):
```typescript
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.svg?url' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}
```

**Usage in Components**:
```typescript
import { LogoWhiteGold } from '@fundrbolt/shared/assets';

function Header() {
  return <img src={LogoWhiteGold} alt="Fundrbolt" className="h-12" />;
}
```

**Asset Optimization**:
- SVG: Vite automatically optimizes SVG (removes comments, minifies)
- PNG: Use pre-optimized PNGs from designer (ImageOptim, TinyPNG)
- No runtime optimization needed (build-time only)

**Alternatives Considered**:
- Direct file path imports: Rejected as not type-safe, no build optimization
- Webpack-style `require()`: Rejected as not compatible with ESM/Vite
- Manual asset copying to public/: Rejected as bypasses Vite processing, no fingerprinting

**References**:
- [Vite Static Asset Handling](https://vitejs.dev/guide/assets.html)
- [Vite Asset Import Patterns](https://vitejs.dev/guide/assets.html#explicit-url-imports)

---

## R5: Favicon Generation Best Practices

**Decision**: Use online favicon generators (Favicon.io, RealFaviconGenerator) with manual placement

**Rationale**:
- **Comprehensive format coverage**: Generates all required sizes (16x16 to 512x512) and formats (ICO, PNG, SVG)
- **Cross-browser compatibility**: Includes Apple Touch Icon, Android Chrome icons, Windows tiles
- **Manifest generation**: Produces Web App Manifest JSON for PWA integration
- **Visual preview**: Shows how favicon appears across devices before download
- **No build pipeline complexity**: Manual generation is one-time setup; automated generation adds build complexity for rare updates

**Recommended Tools**:
1. **Favicon.io** - https://favicon.io/
   - Upload logo → auto-generates all sizes
   - Simple, fast, free
   - Best for quick generation

2. **RealFaviconGenerator** - https://realfavicongenerator.net/
   - Advanced options (background color, margins, scaling)
   - Platform-specific previews (iOS, Android, Windows)
   - Generates HTML snippet
   - Best for production-grade favicons

**Process**:
1. Simplify logo for 16x16 visibility (consider icon-only or "F" mark)
2. Upload to generator
3. Download zip with all sizes
4. Copy files to each app's `public/` directory
5. Update HTML `<head>` with favicon links

**Required Files**:
- `favicon.ico` (32x32 with embedded 16x16)
- `favicon.svg` (scalable, modern browsers)
- `favicon-16.png` (browser tabs)
- `favicon-32.png` (taskbar/bookmarks)
- `apple-touch-icon.png` (180x180 for iOS)
- `favicon-192.png` (Android home screen)
- `favicon-512.png` (Android high-res, PWA splash)

**HTML Integration**:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png">
```

**Alternatives Considered**:
- Automated generation in build pipeline: Rejected as over-engineering for infrequent updates
- Single favicon.ico only: Rejected as lacks modern browser support (SVG) and mobile icons
- Use full logo without simplification: Rejected as unreadable at 16x16px

**References**:
- [Favicon.io](https://favicon.io/)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [MDN: Favicon](https://developer.mozilla.org/en-US/docs/Glossary/Favicon)

---

## Research Summary

All technical unknowns resolved:
- ✅ Typography: System font stack defined
- ✅ Logo hosting: Azure Blob Storage CDN configured
- ✅ Linting enforcement: ESLint warnings + pre-commit hooks
- ✅ Asset handling: Vite `?url` imports with type declarations
- ✅ Favicon generation: Online tools with manual placement

**Ready for Phase 1: Design & Contracts**
