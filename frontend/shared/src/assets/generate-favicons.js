#!/usr/bin/env node

/**
 * Simple Favicon Generator
 * Generates PNG favicons in multiple sizes from SVG
 * 
 * This is a temporary solution until actual favicons are provided by designer.
 * 
 * Usage: node generate-favicons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple placeholder favicon data (Base64 encoded 1x1 transparent PNG)
const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const sizes = [
    { name: 'favicon-16.png', size: 16 },
    { name: 'favicon-32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-192.png', size: 192 },
    { name: 'favicon-512.png', size: 512 },
];

const apps = [
    'frontend/fundrbolt-admin/public',
    'frontend/donor-pwa/public',
    'frontend/landing-site/public',
];

console.log('🎨 Generating placeholder favicons...\n');

apps.forEach(appPath => {
    const publicDir = path.join(__dirname, '..', '..', appPath);

    // Create public directory if it doesn't exist
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    // Copy SVG favicon
    const svgSource = path.join(__dirname, 'favicons', 'favicon.svg');
    const svgDest = path.join(publicDir, 'favicon.svg');
    if (fs.existsSync(svgSource)) {
        fs.copyFileSync(svgSource, svgDest);
        console.log(`✓ ${appPath}/favicon.svg`);
    }

    // Generate placeholder PNGs (1x1 transparent)
    sizes.forEach(({ name }) => {
        const destPath = path.join(publicDir, name);
        fs.writeFileSync(destPath, Buffer.from(transparentPng, 'base64'));
        console.log(`✓ ${appPath}/${name}`);
    });

    // Create a simple ICO file (placeholder)
    const icoPath = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(icoPath, Buffer.from(transparentPng, 'base64'));
    console.log(`✓ ${appPath}/favicon.ico\n`);
});

console.log('✅ Placeholder favicons generated!');
console.log('\n⚠️  NOTE: These are temporary 1x1 transparent placeholders.');
console.log('Replace with actual favicons from your designer for production.');
console.log('\nTo generate real favicons, use tools like:');
console.log('- https://favicon.io/');
console.log('- https://realfavicongenerator.net/');
