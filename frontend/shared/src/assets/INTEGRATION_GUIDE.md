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

## 4. Typography System

Fundrbolt uses a centralized typography system with standardized font families and typographic scales.

### Font Families

```typescript
import { fontFamily } from '@fundrbolt/shared/assets';

// System font stack for body text
fontFamily.sans
// ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', ...]

// Geometric sans-serif for headings
fontFamily.heading
// ['Manrope', 'Inter', '-apple-system', 'BlinkMacSystemFont', ...]

// Monospace for code
fontFamily.mono
// ['Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
```

### Typography Scale

Use predefined styles for consistent text hierarchy:

```typescript
import { typography } from '@fundrbolt/shared/assets';

// Heading styles (h1 - h6)
typography.h1  // { fontSize: '3.052rem', lineHeight: '1.2', fontWeight: 700 }
typography.h2  // { fontSize: '2.441rem', lineHeight: '1.2', fontWeight: 700 }
typography.h3  // { fontSize: '1.953rem', lineHeight: '1.25', fontWeight: 600 }
typography.h4  // { fontSize: '1.563rem', lineHeight: '1.3', fontWeight: 600 }
typography.h5  // { fontSize: '1.25rem', lineHeight: '1.3', fontWeight: 600 }
typography.h6  // { fontSize: '1rem', lineHeight: '1.4', fontWeight: 600 }

// Body text styles
typography.body     // { fontSize: '1rem', lineHeight: '1.5', fontWeight: 400 }
typography.small    // { fontSize: '0.875rem', lineHeight: '1.4', fontWeight: 400 }
typography.caption  // { fontSize: '0.75rem', lineHeight: '1.4', fontWeight: 500 }
```

### React Component Examples

#### h1 - Page Title
```tsx
<h1 style={typography.h1}>
  Welcome to Fundrbolt
</h1>
```

#### h2 - Section Heading
```tsx
<h2 style={typography.h2}>
  Upcoming Events
</h2>
```

#### h3 - Subsection Heading
```tsx
<h3 style={typography.h3}>
  Featured Auctions
</h3>
```

#### h4 - Card Heading
```tsx
<h4 style={typography.h4}>
  Event Details
</h4>
```

#### h5 - Small Heading
```tsx
<h5 style={typography.h5}>
  Sponsor Tier
</h5>
```

#### h6 - Metadata Heading
```tsx
<h6 style={typography.h6}>
  Date & Time
</h6>
```

#### Body Text
```tsx
<p style={typography.body}>
  Join us for an evening of giving and community impact.
</p>
```

#### Small Text (UI Elements)
```tsx
<span style={typography.small}>
  Posted 2 hours ago
</span>
```

#### Caption (Footnotes, Labels)
```tsx
<caption style={typography.caption}>
  Table 1: Event Attendance by Year
</caption>
```

### Tailwind CSS Integration

All font families are available as CSS variables in `@theme` blocks:

```css
@theme inline {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, ...;
  --font-heading: 'Manrope', 'Inter', -apple-system, ...;
  --font-mono: 'Monaco', 'Consolas', ...;
}
```

Use in components:
```tsx
// Body text (automatic via global styles)
<body className="font-sans">

// Headings
<h1 className="font-heading font-bold text-5xl">
  Large Title
</h1>

// Code blocks
<code className="font-mono text-sm">
  const example = true;
</code>
```

### CSS Custom Properties

Apply typography via CSS variables:

```css
:root {
  /* Font Families */
  --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, ...;
  --font-family-heading: 'Manrope', 'Inter', -apple-system, ...;
  --font-family-mono: 'Monaco', 'Consolas', ...;
  
  /* Heading Styles */
  --font-h1-size: 3.052rem;
  --font-h1-line-height: 1.2;
  --font-h1-weight: 700;
  
  /* Body Styles */
  --font-body-size: 1rem;
  --font-body-line-height: 1.5;
  --font-body-weight: 400;
}

/* Apply to elements */
body {
  font-family: var(--font-family-sans);
  font-size: var(--font-body-size);
  line-height: var(--font-body-line-height);
}

h1 {
  font-family: var(--font-family-heading);
  font-size: var(--font-h1-size);
  line-height: var(--font-h1-line-height);
  font-weight: var(--font-h1-weight);
}
```

### Design Guidelines

**Font Size Scale**: 1.250 (Major Third)
- Provides clear visual hierarchy
- Base size: 16px (1rem)
- Each level multiplies by 1.25

**Line Height**:
- **Headings**: 1.2-1.3 (tight for impact)
- **Body**: 1.5 (comfortable reading)
- **Small/Caption**: 1.4 (slightly tighter for UI)

**Font Weight**:
- **Headings**: 600-700 (semibold to bold)
- **Body**: 400 (regular for readability)
- **Caption**: 500 (medium for small text clarity)

---

## 5. Theme Usage Patterns

### Pattern 1: Inline Styles (Direct JavaScript)
```typescript
import { colors } from '@fundrbolt/shared/assets';

// Component with inline styles
function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      style={{
        backgroundColor: colors.primary.navy,
        color: colors.text.primary,
        border: `2px solid ${colors.primary.gold}`,
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

// Dynamic theming
function EventHeader({ isPrimaryEvent }: { isPrimaryEvent: boolean }) {
  const bgColor = isPrimaryEvent ? colors.primary.navy : colors.secondary.gray;
  const textColor = isPrimaryEvent ? colors.text.primary : colors.text.secondary;
  
  return (
    <div style={{ backgroundColor: bgColor, color: textColor, padding: '20px' }}>
      <h1>Event Details</h1>
    </div>
  );
}
```

### Pattern 2: Tailwind CSS Utilities
```typescript
// 1. First, add to your tailwind.config.js:
// tailwind.config.js (Tailwind v4 - @theme inline syntax)
// In your theme.css file:
@theme inline {
  --color-brand-navy: #11294c;
  --color-brand-gold: #ffc20e;
  --color-brand-gray: #58595b;
  --color-brand-white: #ffffff;
}

// 2. Then use in your components:
function DonateSection() {
  return (
    <div className="bg-brand-navy text-brand-white p-8 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Support Our Cause</h2>
      <button className="bg-brand-gold text-brand-navy px-6 py-3 rounded-md hover:opacity-90">
        Donate Now
      </button>
    </div>
  );
}

// 3. Responsive layouts with brand colors:
function EventCard() {
  return (
    <div className="bg-white border-brand-gold border-2 rounded-lg overflow-hidden">
      <div className="bg-brand-navy text-brand-white p-4">
        <h3 className="text-xl font-semibold">Annual Gala 2025</h3>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-brand-gray">Join us for an evening of fundraising</p>
        <button className="w-full bg-brand-gold text-brand-navy py-2 rounded hover:brightness-110">
          Register
        </button>
      </div>
    </div>
  );
}
```

### Pattern 3: TypeScript with Type Safety
```typescript
import { colors, type BrandColors } from '@fundrbolt/shared/assets';

// Type-safe color utility
function getStatusColor(status: 'active' | 'pending' | 'closed'): string {
  const statusColors = {
    active: colors.primary.gold,
    pending: colors.secondary.gray,
    closed: colors.primary.navy,
  } as const;
  
  return statusColors[status];
}

// Type-safe theme hook
function useThemeColors(): BrandColors {
  return colors;
}

// Component with full type safety
interface ThemedComponentProps {
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
}

function ThemedComponent({ variant, children }: ThemedComponentProps) {
  const themeColors = useThemeColors();
  
  const bgColor = variant === 'primary' 
    ? themeColors.primary.navy 
    : themeColors.secondary.white;
    
  const textColor = variant === 'primary'
    ? themeColors.text.primary
    : themeColors.text.secondary;
  
  return (
    <div style={{ backgroundColor: bgColor, color: textColor }}>
      {children}
    </div>
  );
}

// Extract specific color palette
type PrimaryColors = BrandColors['primary'];
function getPrimaryPalette(): PrimaryColors {
  return {
    navy: colors.primary.navy,
    gold: colors.primary.gold,
  };
}
```

### Pattern 4: CSS Variables (For Global Theming)
```typescript
// In your root App component or layout:
import { colors } from '@fundrbolt/shared/assets';

function App() {
  useEffect(() => {
    // Set CSS custom properties
    document.documentElement.style.setProperty('--color-primary', colors.primary.navy);
    document.documentElement.style.setProperty('--color-accent', colors.primary.gold);
    document.documentElement.style.setProperty('--color-text', colors.text.primary);
    document.documentElement.style.setProperty('--color-bg', colors.background.default);
  }, []);

  return <YourApp />;
}

// Then use in any CSS file:
/* styles.css */
.hero-section {
  background-color: var(--color-primary);
  color: var(--color-text);
}

.cta-button {
  background-color: var(--color-accent);
  border: 2px solid var(--color-primary);
}
```

### Pattern 5: Styled Components / CSS-in-JS
```typescript
import styled from 'styled-components'; // or @emotion/styled
import { colors } from '@fundrbolt/shared/assets';

const PrimaryButton = styled.button`
  background-color: ${colors.primary.navy};
  color: ${colors.text.primary};
  border: 2px solid ${colors.primary.gold};
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  
  &:hover {
    background-color: ${colors.primary.gold};
    color: ${colors.primary.navy};
  }
`;

const EventCard = styled.div`
  background-color: ${colors.secondary.white};
  border: 1px solid ${colors.secondary.gray};
  
  .card-header {
    background-color: ${colors.primary.navy};
    color: ${colors.text.primary};
    padding: 16px;
  }
  
  .card-body {
    padding: 16px;
    color: ${colors.text.secondary};
  }
`;
```

---

## 6. Enforcing Navy Background

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

## 7. Replacing Placeholders with Real Assets

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

## 7.5. Theme Update Workflow

### Updating Brand Colors

When brand colors need to change (rebranding, shade adjustments):

**Step 1**: Update colors in the central source file:

```typescript
// frontend/shared/src/assets/themes/colors.ts

export const colors = {
  primary: {
    navy: '#11294c',  // Update this value
    gold: '#ffc20e',  // Or this value
  },
  // ... rest of color definitions
} as const;
```

**Step 2**: Validate your changes:

```bash
cd frontend/shared
pnpm validate:theme
```

This runs validation checks to ensure:
- All color values are valid hex codes
- Required color fields are present
- TypeScript types are correct

**Step 3**: Rebuild all applications:

```bash
# From repository root
cd frontend/fundrbolt-admin && pnpm build
cd frontend/donor-pwa && pnpm build
cd frontend/landing-site && pnpm build
```

Or use the Makefile shortcuts:
```bash
make build-frontend
```

**Step 4**: Verify changes:
- Check all apps render correctly
- Verify no hardcoded colors remain
- Test in different browsers
- Check accessibility (contrast ratios)

**Step 5**: Document the change:

```markdown
// frontend/shared/src/assets/themes/CHANGELOG.md

## [1.1.0] - 2025-01-15
### Changed
- Updated Navy color from #11294c to #0f2341 for better contrast
- Updated Gold color from #ffc20e to #ffd32a for WCAG AAA compliance
```

### Updating Typography

To change font families or typographic scale:

**Step 1**: Update typography source:

```typescript
// frontend/shared/src/assets/themes/typography.ts

export const fontFamily = {
  sans: ['Inter', /* fallbacks */],  // Change primary font here
  heading: ['Manrope', /* fallbacks */],
  // ...
};

export const typography: TypographyScale = {
  h1: {
    fontSize: '3.052rem',  // Adjust sizes here
    lineHeight: '1.2',
    fontWeight: 700,
  },
  // ...
};
```

**Step 2**: Update @theme configurations:

```css
/* frontend/fundrbolt-admin/src/styles/theme.css */
/* frontend/donor-pwa/src/styles/theme.css */

@theme inline {
  --font-sans: 'Inter', ...;  /* Update to match typography.ts */
  --font-heading: 'Manrope', ...;
}
```

**Step 3**: Rebuild and test all applications.

### Testing Theme Changes

Before committing theme changes, test the workflow:

```bash
# Temporarily change a color value
# frontend/shared/src/assets/themes/colors.ts
# gold: '#ffc30f' (was #ffc20e)

# Rebuild all apps
cd frontend/fundrbolt-admin && pnpm build
cd frontend/donor-pwa && pnpm build  
cd frontend/landing-site && pnpm build

# Verify changes appear everywhere
# Check components that use colors.primary.gold
# Check email templates (if applicable)

# Revert test change
git checkout frontend/shared/src/assets/themes/colors.ts
```

### Validation Script

Run theme validation before committing changes:

```bash
cd frontend/shared
pnpm validate:theme
```

The validation script checks:
- ✅ All color values are valid 6-digit hex codes
- ✅ Required color fields exist (primary.navy, primary.gold, etc.)
- ✅ Typography scale has all required levels (h1-h6, body, small, caption)
- ✅ Font weights are valid numbers (100-900)
- ✅ Font sizes use rem or px units
- ❌ No hardcoded color values in components (use ESLint for this)

### Change Log Requirements

All theme changes must be documented in `CHANGELOG.md`:

```markdown
## [Major.Minor.Patch] - YYYY-MM-DD
### Added
- New color: `colors.status.info` for informational messages

### Changed
- Updated Navy from #11294c to #0f2341 for better dark mode contrast
- Increased h1 font size from 3.052rem to 3.5rem

### Deprecated
- `colors.legacy.blue` - Use `colors.primary.navy` instead

### Removed
- Old hover states (replaced with gold accent)

### Fixed
- Typography line heights now consistent across all heading levels
```

Follow [Semantic Versioning](https://semver.org/) for theme versions:
- **Major** (1.0.0 → 2.0.0): Breaking changes (rename color keys, remove colors)
- **Minor** (1.0.0 → 1.1.0): New features (add new colors, new typography levels)
- **Patch** (1.0.0 → 1.0.1): Bug fixes (adjust hex values, fix typos)

---

## 9. Best Practices

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

## 10. Linting & Validation

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

## 11. Testing Your Integration

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
