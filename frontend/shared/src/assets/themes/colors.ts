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

  accent: {
    plum: '#1f0256',
    aqua: '#17ccfc',
    violet: '#5d31ff',
    magenta: '#f35aff',
  },

  // Extended palette for UI illustrations and neutral surfaces
  palette: {
    midnightSlate: '#1d2b3f',
    obsidian: '#0d1628',
    steelBlue: '#426187',
    cobalt: '#2a62bc',
    indigo: '#2f5491',
    deepNavy: '#17273f',
    silver: '#d9d9d9',
    cloud: '#ecedef',
    fog: '#c0c4c4',
    ink: '#1e293b',
    sunset: '#ff5533',
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
  '--color-accent-plum': colors.accent.plum,
  '--color-accent-aqua': colors.accent.aqua,
  '--color-accent-violet': colors.accent.violet,
  '--color-accent-magenta': colors.accent.magenta,
  '--color-palette-midnight-slate': colors.palette.midnightSlate,
  '--color-palette-obsidian': colors.palette.obsidian,
  '--color-palette-steel-blue': colors.palette.steelBlue,
  '--color-palette-cobalt': colors.palette.cobalt,
  '--color-palette-indigo': colors.palette.indigo,
  '--color-palette-deep-navy': colors.palette.deepNavy,
  '--color-palette-silver': colors.palette.silver,
  '--color-palette-cloud': colors.palette.cloud,
  '--color-palette-fog': colors.palette.fog,
  '--color-palette-ink': colors.palette.ink,
  '--color-palette-sunset': colors.palette.sunset,
} as const;

export default colors;
