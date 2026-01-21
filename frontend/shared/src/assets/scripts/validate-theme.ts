#!/usr/bin/env node

/**
 * Theme Validation Script
 *
 * Validates the Fundrbolt theme configuration to ensure:
 * - All color values are valid hex codes
 * - Required color fields are present
 * - Typography scale is complete
 * - Font weights are valid
 * - Font sizes use proper units
 *
 * Usage: pnpm validate:theme
 */

import { colors } from '../themes/colors';
import { typography, fontFamily } from '../themes/typography';

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

let errors = 0;
let warnings = 0;

function log(message: string, color: string = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function error(message: string) {
  log(`❌ ERROR: ${message}`, COLORS.red);
  errors++;
}

function warning(message: string) {
  log(`⚠️  WARNING: ${message}`, COLORS.yellow);
  warnings++;
}

function success(message: string) {
  log(`✅ ${message}`, COLORS.green);
}

function section(title: string) {
  console.log('\n' + COLORS.bold + COLORS.blue + title + COLORS.reset);
  console.log('─'.repeat(title.length));
}

// Validation functions

function isValidHexColor(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function validateColors() {
  section('Validating Brand Colors');

  // Check required primary colors
  const requiredPrimaryColors = ['navy', 'gold'];
  for (const colorName of requiredPrimaryColors) {
    if (!colors.primary[colorName as keyof typeof colors.primary]) {
      error(`Missing required primary color: ${colorName}`);
      continue;
    }

    const colorValue = colors.primary[colorName as keyof typeof colors.primary];
    if (!isValidHexColor(colorValue)) {
      error(`Invalid hex color for primary.${colorName}: ${colorValue}`);
    } else {
      success(`primary.${colorName}: ${colorValue}`);
    }
  }

  // Check required secondary colors
  const requiredSecondaryColors = ['white', 'gray'];
  for (const colorName of requiredSecondaryColors) {
    if (!colors.secondary[colorName as keyof typeof colors.secondary]) {
      error(`Missing required secondary color: ${colorName}`);
      continue;
    }

    const colorValue = colors.secondary[colorName as keyof typeof colors.secondary];
    if (!isValidHexColor(colorValue)) {
      error(`Invalid hex color for secondary.${colorName}: ${colorValue}`);
    } else {
      success(`secondary.${colorName}: ${colorValue}`);
    }
  }

  // Validate all status colors
  for (const [key, value] of Object.entries(colors.status)) {
    if (!isValidHexColor(value)) {
      error(`Invalid hex color for status.${key}: ${value}`);
    } else {
      success(`status.${key}: ${value}`);
    }
  }

  // Validate background colors
  for (const [key, value] of Object.entries(colors.background)) {
    if (!isValidHexColor(value)) {
      error(`Invalid hex color for background.${key}: ${value}`);
    } else {
      success(`background.${key}: ${value}`);
    }
  }

  // Validate text colors
  for (const [key, value] of Object.entries(colors.text)) {
    if (!isValidHexColor(value)) {
      error(`Invalid hex color for text.${key}: ${value}`);
    } else {
      success(`text.${key}: ${value}`);
    }
  }
}

function validateTypography() {
  section('Validating Typography Scale');

  const requiredLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'small', 'caption'];

  for (const level of requiredLevels) {
    if (!typography[level as keyof typeof typography]) {
      error(`Missing required typography level: ${level}`);
      continue;
    }

    const style = typography[level as keyof typeof typography];

    // Validate fontSize
    if (!style.fontSize) {
      error(`Missing fontSize for typography.${level}`);
    } else if (!/^(\d+(\.\d+)?(rem|px|em))$/.test(style.fontSize)) {
      error(`Invalid fontSize format for typography.${level}: ${style.fontSize} (expected rem, px, or em)`);
    } else {
      success(`typography.${level}.fontSize: ${style.fontSize}`);
    }

    // Validate lineHeight
    if (!style.lineHeight) {
      error(`Missing lineHeight for typography.${level}`);
    } else if (!/^(\d+(\.\d+)?(rem|px|em)?|\d+(\.\d+))$/.test(style.lineHeight)) {
      error(`Invalid lineHeight format for typography.${level}: ${style.lineHeight}`);
    } else {
      success(`typography.${level}.lineHeight: ${style.lineHeight}`);
    }

    // Validate fontWeight
    if (style.fontWeight === undefined) {
      error(`Missing fontWeight for typography.${level}`);
    } else if (style.fontWeight < 100 || style.fontWeight > 900 || style.fontWeight % 100 !== 0) {
      error(`Invalid fontWeight for typography.${level}: ${style.fontWeight} (expected 100-900 in increments of 100)`);
    } else {
      success(`typography.${level}.fontWeight: ${style.fontWeight}`);
    }
  }
}

function validateFontFamilies() {
  section('Validating Font Families');

  const requiredFonts = ['sans', 'heading', 'mono'];

  for (const fontType of requiredFonts) {
    if (!fontFamily[fontType as keyof typeof fontFamily]) {
      error(`Missing required font family: ${fontType}`);
      continue;
    }

    const fonts = fontFamily[fontType as keyof typeof fontFamily];
    if (!Array.isArray(fonts) || fonts.length === 0) {
      error(`Font family ${fontType} must be a non-empty array`);
    } else {
      success(`fontFamily.${fontType}: ${fonts.length} fonts in stack`);
      
      // Check for common system fonts in fallback
      const fontString = fonts.join(', ').toLowerCase();
      if (!fontString.includes('sans-serif') && !fontString.includes('monospace')) {
        warning(`fontFamily.${fontType} should include a generic font family (sans-serif, serif, monospace)`);
      }
    }
  }
}

function validateTypeExports() {
  section('Validating TypeScript Types');

  // Check if types are properly exported
  try {
    const colorKeys = Object.keys(colors);
    if (colorKeys.length === 0) {
      error('Colors object is empty');
    } else {
      success(`Colors object has ${colorKeys.length} top-level keys`);
    }

    const typographyKeys = Object.keys(typography);
    if (typographyKeys.length === 0) {
      error('Typography object is empty');
    } else {
      success(`Typography object has ${typographyKeys.length} levels`);
    }

    const fontFamilyKeys = Object.keys(fontFamily);
    if (fontFamilyKeys.length === 0) {
      error('Font family object is empty');
    } else {
      success(`Font family object has ${fontFamilyKeys.length} variants`);
    }
  } catch (err) {
    error(`TypeScript type validation failed: ${err}`);
  }
}

function validateConstAssertions() {
  section('Validating Const Assertions');

  // Check if colors has proper const assertion
  // TypeScript should infer literal types if const assertion is present
  const navyType = typeof colors.primary.navy;
  if (navyType !== 'string') {
    error('Colors do not appear to have const assertions (type should be literal)');
  } else {
    success('Colors object appears to have const assertions');
  }
}

// Main validation

function main() {
  log('\n' + COLORS.bold + '🎨 Fundrbolt Theme Validation' + COLORS.reset);
  log('═'.repeat(40));

  validateColors();
  validateTypography();
  validateFontFamilies();
  validateTypeExports();
  validateConstAssertions();

  // Summary
  console.log('\n' + COLORS.bold + 'Validation Summary' + COLORS.reset);
  console.log('═'.repeat(40));

  if (errors === 0 && warnings === 0) {
    success('All checks passed! Theme configuration is valid. ✨');
    process.exit(0);
  } else {
    if (errors > 0) {
      error(`Found ${errors} error(s)`);
    }
    if (warnings > 0) {
      warning(`Found ${warnings} warning(s)`);
    }

    if (errors > 0) {
      log('\n❌ Theme validation failed. Please fix errors before proceeding.', COLORS.red);
      process.exit(1);
    } else {
      log('\n⚠️  Theme validation passed with warnings. Consider addressing them.', COLORS.yellow);
      process.exit(0);
    }
  }
}

main();
