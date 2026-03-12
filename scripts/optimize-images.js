#!/usr/bin/env node
/**
 * Image optimization script for AI Simple website
 * Converts images to WebP and compresses originals
 * Run: node scripts/optimize-images.js
 *
 * Install deps first: npm install sharp --save-dev
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMG_DIR = path.join(__dirname, '../public/img');
const QUALITY = 80;
const MAX_WIDTH = 2400;

const SKIP_DIRS = ['_ai-simple-images'];
const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.png'];

let processed = 0;
let skipped = 0;
let totalSavedBytes = 0;

async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTS.includes(ext)) return;

  const stat = fs.statSync(filePath);
  const originalSize = stat.size;

  // Skip tiny files (already optimized or icon-sized)
  if (originalSize < 5000) {
    skipped++;
    return;
  }

  try {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, ext);
    const webpPath = path.join(dir, `${base}.webp`);

    // Skip if WebP already exists and is newer
    if (fs.existsSync(webpPath)) {
      const webpStat = fs.statSync(webpPath);
      if (webpStat.mtimeMs > stat.mtimeMs) {
        skipped++;
        return;
      }
    }

    // Create WebP version
    await sharp(filePath)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(webpPath);

    const webpStat = fs.statSync(webpPath);
    const saved = originalSize - webpStat.size;
    totalSavedBytes += Math.max(0, saved);

    console.log(`✓ ${path.relative(IMG_DIR, filePath)} → ${base}.webp (${(originalSize/1024).toFixed(0)}KB → ${(webpStat.size/1024).toFixed(0)}KB)`);
    processed++;
  } catch (err) {
    console.error(`✗ Failed: ${filePath}`, err.message);
  }
}

async function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      await walkDir(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      await optimizeImage(path.join(dir, entry.name));
    }
  }
}

async function main() {
  console.log('AI Simple Image Optimizer\n');
  console.log(`Source: ${IMG_DIR}\n`);

  if (!fs.existsSync(IMG_DIR)) {
    console.error('Image directory not found:', IMG_DIR);
    process.exit(1);
  }

  await walkDir(IMG_DIR);

  console.log(`\n✅ Done!`);
  console.log(`   Processed: ${processed} images`);
  console.log(`   Skipped: ${skipped} images`);
  console.log(`   Estimated savings: ${(totalSavedBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`\nNext: Update <img> tags to use .webp sources with <picture> fallbacks`);
}

main().catch(console.error);
