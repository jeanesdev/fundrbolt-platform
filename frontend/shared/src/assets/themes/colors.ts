/**
 * Fundrbolt Brand Colors
 * 
 * IMPORTANT: These are the official brand colors. Do not hardcode colors in components.
 * Always reference these constants to maintain brand consistency across all applications.
 */

export const colors = {
  // Primary Brand Colors
  primary: {
    navy: '#11294c',
    gold: '#ffc20e',
  },

  // Secondary Colors
  secondary: {
    white: '#ffffff',
    gray: '#58595b',
  },

  // Semantic Colors (derived from brand colors)
  background: {
    default: '#11294c', // Navy background for all apps
    light: '#ffffff',
    dark: '#000000',
  },

  text: {
    primary: '#ffffff',    // White text on navy backgrounds
    secondary: '#ffc20e',  // Gold text for emphasis
    onLight: '#11294c',    // Navy text on white backgrounds
    muted: '#58595b',      // Gray text for secondary content
  },

  // Status Colors (to be defined as needed)
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const;

// Type-safe color access
export type BrandColors = typeof colors;

// CSS Custom Properties for easy CSS integration
export const cssVariables = {
  '--color-primary-navy': colors.primary.navy,
  '--color-primary-gold': colors.primary.gold,
  '--color-secondary-white': colors.secondary.white,
  '--color-secondary-gray': colors.secondary.gray,
  '--color-background-default': colors.background.default,
  '--color-text-primary': colors.text.primary,
  '--color-text-secondary': colors.text.secondary,
} as const;

export default colors;
