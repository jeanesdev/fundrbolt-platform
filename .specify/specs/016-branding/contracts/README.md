# API Contracts - Centralized Brand Assets and Theme System

**Feature**: 016-branding

## Overview

This feature is **primarily frontend-focused** with static asset management. There are no new REST API endpoints. The "contracts" for this feature are:

1. **TypeScript Export Contracts**: How assets are exported from `@fundrbolt/shared/assets`
2. **File Structure Conventions**: Where assets are stored and how they're named
3. **Email Service Integration**: How backend retrieves logo URLs for email templates

---

## Contract 1: Asset Export Interface

**File**: `frontend/shared/src/assets/index.ts`

**Purpose**: Central export point for all brand assets with type-safe imports

### Logo Exports

```typescript
// Logo SVG imports (for web use)
export { default as LogoNavyGold } from './logos/fundrbolt-logo-navy-gold.svg?url';
export { default as LogoWhiteGold } from './logos/fundrbolt-logo-white-gold.svg?url';

// Logo PNG imports (for email, legacy browsers)
export { default as LogoNavyGoldPng } from './logos/fundrbolt-logo-navy-gold.png';
export { default as LogoWhiteGoldPng } from './logos/fundrbolt-logo-white-gold.png';

// Helper function: Get logo based on background type
export function getLogo(backgroundType: 'light' | 'dark'): string {
  return backgroundType === 'dark' ? LogoWhiteGold : LogoNavyGold;
}
```

### Theme Exports

```typescript
// Color constants
export { colors } from './themes/colors';

// Type exports
export type { BrandColors } from './themes/colors';
```

### Usage Contract

**Consumer applications import like this**:

```typescript
// Recommended: Named imports
import { colors, LogoNavyGold, getLogo } from '@fundrbolt/shared/assets';

// Logo usage
<img src={LogoNavyGold} alt="Fundrbolt" className="h-12" />

// Dynamic logo based on theme
<img src={getLogo(isDarkMode ? 'dark' : 'light')} alt="Fundrbolt" />

// Color usage
<div style={{ backgroundColor: colors.primary.navy }}>
  <span style={{ color: colors.neutral.white }}>Welcome</span>
</div>

// TypeScript type checking
const myColor: string = colors.primary.gold; // ✅ Valid
const badColor: string = colors.primary.blue; // ❌ TypeScript error
```

**Forbidden patterns** (will fail ESLint):

```typescript
// ❌ Hardcoded hex colors
<div style={{ color: '#11294c' }}>Text</div>

// ❌ Hardcoded RGB colors
<div style={{ color: 'rgb(17, 41, 76)' }}>Text</div>

// ✅ Correct usage
import { colors } from '@fundrbolt/shared/assets';
<div style={{ color: colors.primary.navy }}>Text</div>
```

---

## Contract 2: File Structure Convention

**Purpose**: Standardized locations for brand assets across the monorepo

### Frontend Assets

```
frontend/shared/src/assets/
├── index.ts                          # Central export point
├── vite-env.d.ts                     # TypeScript declarations for asset imports
├── README.md                         # Asset usage documentation
├── INTEGRATION_GUIDE.md              # Developer onboarding guide
├── logos/
│   ├── fundrbolt-logo-navy-gold.svg  # Primary logo for light backgrounds
│   ├── fundrbolt-logo-navy-gold.png  # PNG variant for email/legacy
│   ├── fundrbolt-logo-white-gold.svg # Logo for dark backgrounds
│   ├── fundrbolt-logo-white-gold.png # PNG variant for email/legacy
│   ├── README.md                     # Logo usage guide
│   └── [designer-originals]/         # SVG/, PNG/, PDF/, JPEG/, Illustrator/
├── favicons/
│   ├── favicon.svg                   # Source favicon (scalable)
│   ├── generate-favicons.js          # Script to deploy to all apps
│   └── README.md                     # Favicon generation guide
└── themes/
    └── colors.ts                     # Brand color constants
```

### Public Directories (per app)

Each frontend app has these files in `public/`:

```
frontend/{app-name}/public/
├── favicon.ico              # 32x32 ICO (with 16x16 embedded)
├── favicon.svg              # Scalable favicon for modern browsers
├── favicon-16.png           # 16x16 PNG for browser tabs
├── favicon-32.png           # 32x32 PNG for bookmarks
├── apple-touch-icon.png     # 180x180 PNG for iOS home screen
├── favicon-192.png          # 192x192 PNG for Android home screen
└── favicon-512.png          # 512x512 PNG for high-res displays
```

**Apps**:
- `frontend/fundrbolt-admin/public/`
- `frontend/donor-pwa/public/`
- `frontend/landing-site/public/`

### Azure Blob Storage (email logos)

```
Azure Storage Account: fundrboltstorage
Container: branding (public blob access)
Files:
├── logos/
│   ├── fundrbolt-logo-navy-gold.png
│   └── fundrbolt-logo-white-gold.png
```

**CDN URLs**:
- `https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-navy-gold.png`
- `https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-white-gold.png`

---

## Contract 3: Email Service Logo Integration

**Purpose**: Backend email service retrieves logo URLs from Azure CDN

### Method Signature

```python
# backend/app/services/email_service.py

class EmailService:
    def _get_logo_url(self, background: str = "dark") -> str:
        """
        Get Azure CDN logo URL for email templates.
        
        Args:
            background: "light" or "dark" - determines which logo variant to use
            
        Returns:
            Full HTTPS URL to logo PNG on Azure CDN
            
        Examples:
            >>> email_service._get_logo_url("dark")
            'https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-white-gold.png'
            
            >>> email_service._get_logo_url("light")
            'https://fundrbolt-branding.azureedge.net/logos/fundrbolt-logo-navy-gold.png'
        """
        base_url = settings.AZURE_CDN_LOGO_BASE_URL
        
        if background == "dark":
            return f"{base_url}/fundrbolt-logo-white-gold.png"
        else:
            return f"{base_url}/fundrbolt-logo-navy-gold.png"
```

### Configuration

```python
# backend/app/core/config.py

class Settings(BaseSettings):
    # ... existing settings ...
    
    AZURE_CDN_LOGO_BASE_URL: str = "https://fundrbolt-branding.azureedge.net/logos"
    
    class Config:
        env_file = ".env"
```

### Email Template Usage

```html
<!-- backend/app/templates/emails/base.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #11294c;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <img src="{{ logo_url }}" 
                     alt="Fundrbolt" 
                     style="height: 60px; display: block;" />
            </td>
        </tr>
    </table>
    
    <!-- Email content goes here -->
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #58595b; margin-top: 40px;">
        <tr>
            <td align="center" style="padding: 20px; color: #ffffff; font-size: 12px;">
                © 2026 Fundrbolt. All rights reserved.
            </td>
        </tr>
    </table>
</body>
</html>
```

### Template Rendering

```python
# backend/app/services/email_service.py

async def send_verification_email(self, email: str, token: str) -> None:
    """Send email verification with branded logo"""
    logo_url = self._get_logo_url(background="dark")  # Dark header background
    
    template_context = {
        "logo_url": logo_url,
        "logo_alt": "Fundrbolt",
        "verification_link": f"{settings.FRONTEND_URL}/verify-email?token={token}",
    }
    
    html_content = self._render_template("emails/verify_email.html", template_context)
    
    await self._send_email(
        to=email,
        subject="Verify your Fundrbolt account",
        html=html_content,
    )
```

---

## Contract 4: ESLint Configuration

**Purpose**: Enforce brand color usage through linting

### ESLint Rule Configuration

```javascript
// .eslintrc.js (or .eslintrc.json)
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'warn',  // Warning during development, error during commit
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
  overrides: [
    {
      // Exempt the colors.ts file itself from color hardcoding rule
      files: ['**/themes/colors.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run ESLint on staged TypeScript files (treat warnings as errors)
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings 0"
    ]
  }
}
```

**Behavior**:
- **During development**: Warnings appear in IDE/terminal but don't break build
- **During commit**: Pre-commit hook fails if any warnings exist, blocks commit
- **Developer fixes warning**: Commit proceeds

---

## Contract Summary

| Contract | Type | Consumer | Provider |
|----------|------|----------|----------|
| **Asset Export Interface** | TypeScript module | All frontend apps | `@fundrbolt/shared/assets` |
| **File Structure** | Directory convention | Developers | Monorepo structure |
| **Email Logo URLs** | Python method | Email templates | `EmailService._get_logo_url()` |
| **ESLint Enforcement** | Linting rules | All TypeScript code | ESLint + pre-commit hooks |

**No REST API endpoints required** - all contracts are code-level interfaces and conventions.
