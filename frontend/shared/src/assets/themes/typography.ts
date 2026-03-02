/**
 * Fundrbolt Typography System
 *
 * Defines font families and typographic scale for consistent text display
 * across all applications.
 *
 * Usage:
 * ```typescript
 * import { fontFamily, typography } from '@fundrbolt/shared/assets';
 *
 * // In Tailwind config
 * fontFamily: fontFamily
 *
 * // In components
 * <h1 style={{fontSize: typography.h1.fontSize}}>Title</h1>
 * ```
 */

import type { TypographyScale } from '../types';

/**
 * System Font Stack
 *
 * Uses system fonts for optimal performance and native OS appearance:
 * - Inter: Modern, legible sans-serif for body text
 * - Manrope: Geometric sans-serif for headings
 * - System fallbacks: -apple-system, BlinkMacSystemFont, etc.
 */
export const fontFamily = {
  sans: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Oxygen',
    'Ubuntu',
    'Cantarell',
    'Helvetica Neue',
    'sans-serif',
  ],
  heading: [
    'Manrope',
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'sans-serif',
  ],
  mono: [
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    'monospace',
  ],
} as const;

/**
 * Typography Scale
 *
 * Defines font sizes, line heights, and font weights for consistent
 * typographic hierarchy across all applications.
 *
 * Font Size Scale (1.250 - Major Third):
 * - Base: 16px (1rem)
 * - h6: 16px
 * - h5: 20px (16 * 1.25)
 * - h4: 25px (20 * 1.25)
 * - h3: 31px (25 * 1.25)
 * - h2: 39px (31 * 1.25)
 * - h1: 49px (39 * 1.25)
 *
 * Line Height Guidelines:
 * - Headings: 1.2 (tight for impact)
 * - Body: 1.5 (comfortable reading)
 * - Small text: 1.4 (slightly tighter for UI elements)
 *
 * Font Weight Guidelines:
 * - Headings: 600-700 (semibold to bold)
 * - Body: 400 (regular)
 * - Small/Caption: 400-500 (regular to medium)
 */
export const typography: TypographyScale = {
  h1: {
    fontSize: '3.052rem',  // 48.83px ≈ 49px
    lineHeight: '1.2',
    fontWeight: 700,       // Bold
  },
  h2: {
    fontSize: '2.441rem',  // 39.06px ≈ 39px
    lineHeight: '1.2',
    fontWeight: 700,       // Bold
  },
  h3: {
    fontSize: '1.953rem',  // 31.25px ≈ 31px
    lineHeight: '1.25',
    fontWeight: 600,       // Semibold
  },
  h4: {
    fontSize: '1.563rem',  // 25px
    lineHeight: '1.3',
    fontWeight: 600,       // Semibold
  },
  h5: {
    fontSize: '1.25rem',   // 20px
    lineHeight: '1.3',
    fontWeight: 600,       // Semibold
  },
  h6: {
    fontSize: '1rem',      // 16px
    lineHeight: '1.4',
    fontWeight: 600,       // Semibold
  },
  body: {
    fontSize: '1rem',      // 16px
    lineHeight: '1.5',     // Comfortable reading
    fontWeight: 400,       // Regular
  },
  small: {
    fontSize: '0.875rem',  // 14px
    lineHeight: '1.4',
    fontWeight: 400,       // Regular
  },
  caption: {
    fontSize: '0.75rem',   // 12px
    lineHeight: '1.4',
    fontWeight: 500,       // Medium (slightly bolder for readability at small size)
  },
} as const;

// Type exports
export type FontFamily = typeof fontFamily;

// CSS Custom Properties for easy CSS integration
export const typographyCssVariables = {
  // Font Families
  '--font-family-sans': fontFamily.sans.join(', '),
  '--font-family-heading': fontFamily.heading.join(', '),
  '--font-family-mono': fontFamily.mono.join(', '),

  // Heading Styles
  '--font-h1-size': typography.h1.fontSize,
  '--font-h1-line-height': typography.h1.lineHeight,
  '--font-h1-weight': typography.h1.fontWeight.toString(),

  '--font-h2-size': typography.h2.fontSize,
  '--font-h2-line-height': typography.h2.lineHeight,
  '--font-h2-weight': typography.h2.fontWeight.toString(),

  '--font-h3-size': typography.h3.fontSize,
  '--font-h3-line-height': typography.h3.lineHeight,
  '--font-h3-weight': typography.h3.fontWeight.toString(),

  '--font-h4-size': typography.h4.fontSize,
  '--font-h4-line-height': typography.h4.lineHeight,
  '--font-h4-weight': typography.h4.fontWeight.toString(),

  '--font-h5-size': typography.h5.fontSize,
  '--font-h5-line-height': typography.h5.lineHeight,
  '--font-h5-weight': typography.h5.fontWeight.toString(),

  '--font-h6-size': typography.h6.fontSize,
  '--font-h6-line-height': typography.h6.lineHeight,
  '--font-h6-weight': typography.h6.fontWeight.toString(),

  // Body Styles
  '--font-body-size': typography.body.fontSize,
  '--font-body-line-height': typography.body.lineHeight,
  '--font-body-weight': typography.body.fontWeight.toString(),

  '--font-small-size': typography.small.fontSize,
  '--font-small-line-height': typography.small.lineHeight,
  '--font-small-weight': typography.small.fontWeight.toString(),

  '--font-caption-size': typography.caption.fontSize,
  '--font-caption-line-height': typography.caption.lineHeight,
  '--font-caption-weight': typography.caption.fontWeight.toString(),
} as const;
