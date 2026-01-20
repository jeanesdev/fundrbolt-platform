# Quickstart - Centralized Brand Assets and Theme System

**Feature**: 016-branding  
**Audience**: Developers integrating brand assets into Fundrbolt applications

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Shared Package (if not already installed)

```bash
cd frontend/{your-app}  # fundrbolt-admin, donor-pwa, or landing-site
pnpm install @fundrbolt/shared
```

### Step 2: Import Brand Assets

```typescript
// In your React component
import { colors, LogoNavyGold, LogoWhiteGold, getLogo } from '@fundrbolt/shared/assets';

function Header() {
  return (
    <header style={{ backgroundColor: colors.primary.navy }}>
      <img src={LogoWhiteGold} alt="Fundrbolt" className="h-12" />
    </header>
  );
}
```

### Step 3: Update Tailwind Config (optional, for utility classes)

```javascript
// tailwind.config.js
import { colors } from '@fundrbolt/shared/assets';

export default {
  theme: {
    extend: {
      colors: {
        'brand-navy': colors.primary.navy,
        'brand-gold': colors.primary.gold,
        'brand-gray': colors.neutral.gray,
      },
    },
  },
};
```

**Usage**:
```tsx
<button className="bg-brand-navy text-white">Donate Now</button>
```

---

## 📖 Common Use Cases

### Use Case 1: Display Logo Based on Theme

```typescript
import { getLogo } from '@fundrbolt/shared/assets';

function ThemedHeader({ isDarkMode }: { isDarkMode: boolean }) {
  const logoSrc = getLogo(isDarkMode ? 'dark' : 'light');
  
  return (
    <header className={isDarkMode ? 'bg-navy-900' : 'bg-white'}>
      <img src={logoSrc} alt="Fundrbolt" className="h-12" />
    </header>
  );
}
```

**When to use**:
- Dark mode toggle in app
- Light header on landing pages, dark header in admin dashboard
- User theme preference

### Use Case 2: Brand Colors in Inline Styles

```typescript
import { colors } from '@fundrbolt/shared/assets';

function PricingCard() {
  return (
    <div style={{
      backgroundColor: colors.neutral.white,
      borderColor: colors.primary.gold,
      color: colors.primary.navy,
    }}>
      <h3>Premium Ticket</h3>
      <p style={{ color: colors.neutral.gray }}>Includes VIP access</p>
    </div>
  );
}
```

**When to use**:
- Email templates (CSS-in-JS not supported)
- Dynamic styles based on props
- Third-party components requiring inline styles

### Use Case 3: Favicons (already configured)

Favicons are pre-deployed to `public/` directories. **No action needed** unless replacing favicons:

```bash
# Update source favicon
cd frontend/shared/src/assets/favicons/
# Edit favicon.svg

# Regenerate and deploy to all apps
node generate-favicons.js
```

**Files updated**:
- `frontend/fundrbolt-admin/public/favicon*.png`
- `frontend/donor-pwa/public/favicon*.png`
- `frontend/landing-site/public/favicon*.png`

---

## ⚠️ Rules & Best Practices

### ✅ DO: Import from shared package

```typescript
import { colors, LogoNavyGold } from '@fundrbolt/shared/assets';
```

### ❌ DON'T: Hardcode hex colors

```typescript
// ❌ Will fail ESLint pre-commit hook
<div style={{ color: '#11294c' }}>Text</div>

// ✅ Correct
<div style={{ color: colors.primary.navy }}>Text</div>
```

### ✅ DO: Use semantic color names

```typescript
// ✅ Clear intent
backgroundColor: colors.primary.navy
color: colors.neutral.white

// ❌ Unclear purpose
backgroundColor: '#11294c'
color: '#ffffff'
```

### ✅ DO: Use getLogo() for theme switching

```typescript
// ✅ Automatically selects correct logo
const logoSrc = getLogo(backgroundType);

// ❌ Manual switching (error-prone)
const logoSrc = isDark ? LogoWhiteGold : LogoNavyGold;
```

---

## 🔧 Troubleshooting

### Issue: "Cannot find module '@fundrbolt/shared/assets'"

**Solution 1**: Ensure shared package is installed
```bash
cd frontend/{your-app}
pnpm install @fundrbolt/shared
```

**Solution 2**: Check package.json exports
```json
{
  "exports": {
    "./assets": "./src/assets/index.ts"
  }
}
```

**Solution 3**: Restart dev server
```bash
pnpm dev  # Vite needs restart after package changes
```

---

### Issue: TypeScript error "Cannot find module '*.svg'"

**Solution**: Ensure `vite-env.d.ts` exists in `frontend/shared/src/assets/`

```typescript
// frontend/shared/src/assets/vite-env.d.ts
/// <reference types="vite/client" />

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

If missing, the file should be created automatically during build.

---

### Issue: ESLint warning "Do not hardcode hex colors"

**Cause**: Hardcoded color values detected

**Solution**: Replace with brand color imports

```typescript
// Before (ESLint warning)
const buttonStyle = { backgroundColor: '#11294c' };

// After (passes linting)
import { colors } from '@fundrbolt/shared/assets';
const buttonStyle = { backgroundColor: colors.primary.navy };
```

**Bypass** (only for third-party code or legitimate exceptions):
```typescript
/* eslint-disable no-restricted-syntax */
const legacyColor = '#11294c'; // Required by legacy API
/* eslint-enable no-restricted-syntax */
```

---

### Issue: Pre-commit hook fails with "Fix ESLint warnings"

**Cause**: Commit blocked due to linting violations

**Solution**:
1. Check which files have warnings:
   ```bash
   npx eslint src/**/*.ts src/**/*.tsx
   ```

2. Fix warnings (auto-fix where possible):
   ```bash
   npx eslint src/**/*.ts src/**/*.tsx --fix
   ```

3. Stage fixed files:
   ```bash
   git add -A
   ```

4. Retry commit:
   ```bash
   git commit -m "your message"
   ```

---

## 📚 Additional Resources

- **Full Integration Guide**: [frontend/shared/src/assets/INTEGRATION_GUIDE.md](../../../frontend/shared/src/assets/INTEGRATION_GUIDE.md)
- **Logo Usage Guide**: [frontend/shared/src/assets/logos/README.md](../../../frontend/shared/src/assets/logos/README.md)
- **Favicon Generation**: [frontend/shared/src/assets/favicons/README.md](../../../frontend/shared/src/assets/favicons/README.md)
- **Feature Specification**: [.specify/specs/016-branding/spec.md](./spec.md)
- **Data Model**: [.specify/specs/016-branding/data-model.md](./data-model.md)
- **Contracts**: [.specify/specs/016-branding/contracts/README.md](./contracts/README.md)

---

## 🎯 Success Checklist

Before marking integration complete, verify:

- [ ] Can import `colors` from `@fundrbolt/shared/assets`
- [ ] Can import `LogoNavyGold` and `LogoWhiteGold` without TypeScript errors
- [ ] No hardcoded hex colors in new code (ESLint passes)
- [ ] Pre-commit hook runs successfully
- [ ] Favicons display correctly in browser tab
- [ ] Logo displays correctly in UI (correct variant for background)
- [ ] Visual regression tests pass (if applicable)

---

## 💬 Need Help?

- Review [INTEGRATION_GUIDE.md](../../../frontend/shared/src/assets/INTEGRATION_GUIDE.md) for detailed examples
- Check [feature specification](./spec.md) for requirements and success criteria
- Ask in team chat or create GitHub issue

**Happy branding! 🎨**
