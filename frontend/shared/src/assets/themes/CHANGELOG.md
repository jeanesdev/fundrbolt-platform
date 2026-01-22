# Fundrbolt Theme Changelog

All notable changes to the Fundrbolt theme system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial typography system with font families and typographic scale
- Font families: Inter (sans), Manrope (heading), Monaco (mono)
- Typography scale: h1-h6, body, small, caption with font sizes, line heights, weights
- Theme validation script (`pnpm validate:theme`)
- Comprehensive theme update workflow documentation

## [1.0.0] - 2025-01

### Added
- Initial Fundrbolt brand color system
- Primary colors: Navy (#11294c), Gold (#ffc20e)
- Secondary colors: White (#ffffff), Gray (#58595b)
- Background colors: Default (Navy), Light (White), Dark (Black)
- Text colors: Primary (White), Secondary (Gold), OnLight (Navy), Muted (Gray)
- Status colors: Success (#10b981), Warning (#f59e0b), Error (#ef4444), Info (#3b82f6)
- CSS custom properties export for easy integration
- TypeScript const assertions for type safety
- Logo system: Navy-Gold and White-Gold variants (SVG and PNG)
- Favicon configuration for all applications
- Integration guide with 5 usage patterns

### Design Decisions
- **Navy Background**: Applied globally across all apps for consistent branding
- **System Fonts**: Use Inter and Manrope with comprehensive system font fallbacks for performance
- **Typography Scale**: 1.250 (Major Third) for clear visual hierarchy
- **Const Assertions**: Enable TypeScript literal type inference for better type safety

---

## Version History

### Version Numbering

Fundrbolt theme follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version (1.0.0 → 2.0.0): Incompatible API changes
  - Renaming color keys (breaks imports)
  - Removing colors or typography levels
  - Changing data structure

- **MINOR** version (1.0.0 → 1.1.0): Backwards-compatible functionality
  - Adding new colors
  - Adding new typography levels
  - New font families

- **PATCH** version (1.0.0 → 1.0.1): Backwards-compatible bug fixes
  - Adjusting color hex values
  - Tweaking font sizes or weights
  - Fixing typos in comments

### Change Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Vulnerability fixes

---

## Template for New Entries

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New color: `colors.accent.purple` (#9333ea) for premium features

### Changed
- Updated Navy from #11294c to #0f2341 for better contrast
- Increased h1 font size from 3.052rem to 3.5rem

### Deprecated
- `colors.legacy.blue` - Use `colors.primary.navy` instead (will be removed in 2.0.0)

### Removed
- Old hover states (replaced with gold accent)

### Fixed
- Typography line heights now consistent across all heading levels
- Fixed font-weight for caption text (was 600, now 500)

### Security
- N/A
```

---

## Migration Guides

### Migrating from 0.x to 1.0

Not applicable - 1.0.0 is the initial release of the centralized theme system.

---

## Related Documentation

- [Integration Guide](../INTEGRATION_GUIDE.md) - How to use theme in applications
- [Typography Guide](./typography.ts) - Font families and typographic scale
- [Color Guide](./colors.ts) - Brand colors and semantic colors
- [Favicon Guide](../favicons/README.md) - Favicon generation and deployment

---

**Last Updated**: January 2025  
**Maintained By**: Fundrbolt Engineering Team  
**Questions**: Contact engineering@fundrbolt.com
