# Fundrbolt Brand Assets - Integration Guide

## Quick Start

All branding assets are now available through the shared package. Import what you need:

```typescript
import { colors, LogoNavyGold, LogoWhiteGold, getLogo } from '@fundrbolt/shared/assets';
```

## ⚠️ Important: Temporary Placeholders

Current logo and favicon files are **temporary placeholders** with proper naming and structure. Replace them with actual designer files when available - no code changes needed, just file replacement.

---

## 1. Using Brand Colors

### TypeScript/JavaScript
```typescript
import { colors } from '@fundrbolt/shared/assets';

// Primary colors
const navyColor = colors.primary.navy;  // '#11294c'
const goldColor = colors.primary.gold;  // '#ffc20e'

// Background
const bgColor = colors.background.default;  // '#11294c' (navy)

// Text colors
const primaryText = colors.text.primary;     // '#ffffff' (white)
const accentText = colors.text.secondary;    // '#ffc20e' (gold)
```

### CSS/Tailwind
```typescript
// Import CSS variables
import { cssVariables } from '@fundrbolt/shared/assets';

// Apply to root element
document.documentElement.style.setProperty('--color-primary-navy', cssVariables['--color-primary-navy']);

// Or use directly in Tailwind config
// tailwind.config.js
module.exports = {
  theme: {
    colors: {
      'brand-navy': '#11294c',
      'brand-gold': '#ffc20e',
      'brand-white': '#ffffff',
      'brand-gray': '#58595b',
    }
  }
};
```

---

## 2. Using Logos

### React Components

```typescript
import { LogoNavyGold, LogoWhiteGold, getLogo } from '@fundrbolt/shared/assets';

// Navy & Gold logo (for white/light backgrounds)
<img src={LogoNavyGold} alt="Fundrbolt" className="h-12" />

// White & Gold logo (for navy/dark backgrounds)
<img src={LogoWhiteGold} alt="Fundrbolt" className="h-12" />

// Automatic selection based on background
<img src={getLogo('dark')} alt="Fundrbolt" className="h-12" />
<img src={getLogo('light')} alt="Fundrbolt" className="h-12" />
```

### Email Templates

Use PNG versions for better email client compatibility:

```typescript
import { LogoWhiteGoldPng } from '@fundrbolt/shared/assets';

// In email template HTML
const emailHtml = `
  <div style="background-color: #11294c; padding: 20px;">
    <img src="${LogoWhiteGoldPng}" alt="Fundrbolt" style="height: 60px;" />
  </div>
`;
```

For production emails, host the PNG on your CDN:
```html
<img src="https://cdn.fundrbolt.com/logo-white-gold.png" alt="Fundrbolt" />
```

---

## 3. Favicons Setup

Favicons have been generated and placed in each app's `public/` directory. Add to your HTML `<head>`:

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

### Vite/React Projects
Most modern frameworks auto-detect favicons in the `public/` directory. Verify by checking browser tabs.

---

## 4. Enforcing Navy Background

### Global CSS (Recommended)
```css
/* In your global CSS or App.css */
body {
  background-color: #11294c;
  color: #ffffff;
}
```

### Tailwind CSS
```typescript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      backgroundColor: {
        'default': '#11294c',
      },
    },
  },
};

// In your root component
<div className="bg-[#11294c] min-h-screen">
  {/* Your app */}
</div>
```

### React Root Component
```typescript
import { colors } from '@fundrbolt/shared/assets';

function App() {
  return (
    <div style={{ backgroundColor: colors.primary.navy, minHeight: '100vh' }}>
      {/* Your app */}
    </div>
  );
}
```

---

## 5. Replacing Placeholders with Real Assets

When you receive actual logo files from the designer:

### Logo Files
1. Replace these files (same filenames):
   - `frontend/shared/src/assets/logos/fundrbolt-logo-navy-gold.svg`
   - `frontend/shared/src/assets/logos/fundrbolt-logo-white-gold.svg`
   - `frontend/shared/src/assets/logos/fundrbolt-logo-navy-gold.png`
   - `frontend/shared/src/assets/logos/fundrbolt-logo-white-gold.png`

2. No code changes needed - imports stay the same!

### Favicon Files
1. Generate favicons using online tools:
   - [Favicon.io](https://favicon.io/)
   - [RealFaviconGenerator](https://realfavicongenerator.net/)

2. Replace files in each app's `public/` directory:
   - `frontend/fundrbolt-admin/public/`
   - `frontend/donor-pwa/public/`
   - `frontend/landing-site/public/`

3. Required files: `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `favicon-192.png`, `favicon-512.png`

---

## 6. Best Practices

### ✅ DO
- Always import colors from `@fundrbolt/shared/assets`
- Use `getLogo()` helper for automatic background detection
- Use SVG logos for web (better scaling)
- Use PNG logos for email templates
- Apply navy background globally across all apps

### ❌ DON'T
- Hardcode color values (`#11294c`) directly in components
- Duplicate logo files across projects
- Use JPEG logos (no transparency)
- Skip favicon setup (important for branding)

---

## 7. Linting & Validation

### Prevent Hardcoded Colors (Recommended)
Add to your ESLint config:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/#[0-9a-f]{3,6}/i]',
        message: 'Do not hardcode hex colors. Use colors from @fundrbolt/shared/assets instead.',
      },
    ],
  },
};
```

---

## 8. Testing Your Integration

### Visual Checklist
- [ ] Navy background (#11294c) applied globally
- [ ] Correct logo variant used (navy/gold on light, white/gold on dark)
- [ ] Favicons appear in browser tabs
- [ ] Apple Touch Icon appears when adding to iOS home screen
- [ ] Logo visible in email clients (Gmail, Outlook, Apple Mail)
- [ ] No hardcoded color values in component code

### Quick Test Command
```bash
# Check for hardcoded navy color
grep -r "#11294c" frontend/*/src/ --exclude-dir=node_modules

# Check for hardcoded gold color  
grep -r "#ffc20e" frontend/*/src/ --exclude-dir=node_modules

# Should only find imports, not direct usage
```

---

## Need Help?

- **Logo issues**: Check that SVG files are loading correctly in browser DevTools
- **Color issues**: Verify imports are resolving to `@fundrbolt/shared/assets`
- **Favicon issues**: Clear browser cache or test in incognito mode
- **Build errors**: Ensure `frontend/shared` package is built (`pnpm build`)

---

**Last Updated**: 2026-01-19  
**Status**: Temporary placeholders in place, ready for designer assets
