/**
 * Brand Asset Types
 * 
 * TypeScript interfaces for all brand assets including logos, colors, and themes.
 */

/**
 * Logo Asset Interface
 * 
 * Represents a logo variant with all necessary metadata
 */
export interface LogoAsset {
  /** Logo variant identifier */
  name: 'navy-gold' | 'white-gold';
  /** Intended background context */
  background: 'light' | 'dark';
  /** SVG file path (preferred for web) */
  svgPath: string;
  /** PNG file path (for email, legacy browsers) */
  pngPath: string;
  /** Recommended display width in pixels */
  width?: number;
  /** Recommended display height in pixels */
  height?: number;
  /** Accessibility text */
  altText: string;
}

/**
 * Favicon Set Interface
 * 
 * Represents all favicon files for browser/mobile display
 */
export interface FaviconSet {
  /** 16x16 PNG for browser tabs */
  size16: string;
  /** 32x32 PNG for bookmarks */
  size32: string;
  /** 180x180 PNG for iOS home screen */
  size180: string;
  /** 192x192 PNG for Android home screen */
  size192: string;
  /** 512x512 PNG for high-res displays */
  size512: string;
  /** Multi-size ICO (32x32 + 16x16 embedded) */
  ico: string;
  /** Scalable SVG for modern browsers */
  svg: string;
}

/**
 * Typography Scale Interface
 * 
 * Defines font sizes, line heights, and font weights for consistent typography
 */
export interface TypographyScale {
  h1: { fontSize: string; lineHeight: string; fontWeight: number };
  h2: { fontSize: string; lineHeight: string; fontWeight: number };
  h3: { fontSize: string; lineHeight: string; fontWeight: number };
  h4: { fontSize: string; lineHeight: string; fontWeight: number };
  h5: { fontSize: string; lineHeight: string; fontWeight: number };
  h6: { fontSize: string; lineHeight: string; fontWeight: number };
  body: { fontSize: string; lineHeight: string; fontWeight: number };
  small: { fontSize: string; lineHeight: string; fontWeight: number };
  caption: { fontSize: string; lineHeight: string; fontWeight: number };
}
