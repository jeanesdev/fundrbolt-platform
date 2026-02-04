/**
 * Fundrbolt Shared Assets
 *
 * Centralized exports for all brand assets including logos, colors, and themes.
 * Import from this file to ensure consistency across all applications.
 *
 * ⚠️ TEMPORARY PLACEHOLDERS: Logo files are currently simple placeholders.
 * Replace with actual logo files from designer when available.
 *
 * @example
 * ```typescript
 * import { colors, LogoNavyGold, getLogo } from '@fundrbolt/shared/assets';
 *
 * // Use in React component
 * <img src={LogoNavyGold} alt="Fundrbolt" />
 *
 * // Or use helper to select based on background
 * <img src={getLogo('dark')} alt="Fundrbolt" />
 * ```
 */

// Export brand colors
export { colors, cssVariables } from './themes/colors';
export type { BrandColors } from './themes/colors';

// Export typography system
export { fontFamily, typography, typographyCssVariables } from './themes/typography';
export type { FontFamily } from './themes/typography';

// Export types
export type { FaviconSet, LogoAsset, TypographyScale } from './types';

// Logo exports - SVG files (TEMPORARY PLACEHOLDERS - Replace with actual logos)
import LogoNavyGoldSvg from './logos/fundrbolt-logo-navy-gold.svg?url';
import LogoWhiteGoldSvg from './logos/fundrbolt-logo-white-gold.svg?url';

export { LogoNavyGoldSvg as LogoNavyGold, LogoWhiteGoldSvg as LogoWhiteGold };

// Logo exports - PNG files for email (TEMPORARY PLACEHOLDERS - Replace with actual logos)
export { default as LogoNavyGoldPng } from './logos/fundrbolt-logo-navy-gold.png';
export { default as LogoWhiteGoldPng } from './logos/fundrbolt-logo-white-gold.png';

// Favicon SVG (TEMPORARY PLACEHOLDER - Replace with actual favicon)
export { default as FaviconSvg } from './favicons/favicon.svg?url';

// Favicon paths (favicons are typically placed in public directory, not imported as modules)
export const faviconPaths = {
  ico: '/favicon.ico',
  svg: '/favicon.svg',
  png16: '/favicon-16.png',
  png32: '/favicon-32.png',
  png192: '/favicon-192.png',
  png512: '/favicon-512.png',
  appleTouchIcon: '/apple-touch-icon.png',
} as const;

/**
 * Logo Component Props Helper
 *
 * Use this to select the correct logo based on background color
 *
 * @param backgroundType - 'light' for white/light backgrounds, 'dark' for navy/dark backgrounds
 * @returns Path to appropriate logo variant
 */
export const getLogo = (backgroundType: 'light' | 'dark' = 'dark') => {
  return backgroundType === 'dark' ? LogoWhiteGoldSvg : LogoNavyGoldSvg;
};
