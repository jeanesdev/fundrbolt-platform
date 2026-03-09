/**
 * Admin PWA Color Theme Constants
 *
 * Hardcoded color values belong here, not in components.
 * This file is exempt from the no-restricted-syntax hex/hsl rule.
 * Import from this file (or @fundrbolt/shared/assets) in components.
 */

import { colors as brandColors } from '@fundrbolt/shared/assets'

export { brandColors }

// ─── Promotion Badge Color Presets ─────────────────────────────────────────
// User-selectable colors for auction item promotion badges.

export const PROMOTION_BADGE_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Default', value: '' },
  { label: 'Red',     value: '#dc2626' },
  { label: 'Orange',  value: '#ea580c' },
  { label: 'Amber',   value: '#d97706' },
  { label: 'Green',   value: '#16a34a' },
  { label: 'Teal',    value: '#0d9488' },
  { label: 'Blue',    value: '#2563eb' },
  { label: 'Violet',  value: '#7c3aed' },
  { label: 'Pink',    value: '#db2777' },
  { label: 'Gray',    value: '#4b5563' },
]

/** White text used on colored promotion badges. */
export const BADGE_TEXT_ON_COLOR = brandColors.secondary.white
