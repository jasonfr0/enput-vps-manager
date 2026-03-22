#!/usr/bin/env node
/**
 * scripts/generate-icons.js
 * ──────────────────────────────────────────────────────────────────────────
 * Generates all required icon formats from a single source PNG (or SVG).
 *
 * Usage:
 *   node scripts/generate-icons.js [source]
 *
 * Arguments:
 *   source   Path to a 1024×1024 (or larger) PNG or SVG.
 *            Defaults to: public/icons/icon-1024.png
 *
 * Output (written to public/icons/):
 *   icon-16.png … icon-1024.png   PNG set (used by Linux & as source)
 *   icon.ico                      Multi-size ICO  (Windows)
 *   icon.icns                     ICNS             (macOS — requires macOS)
 *   icon.png                      512×512 copy     (Linux AppImage)
 *
 * Prerequisites:
 *   npm install --save-dev sharp          (cross-platform PNG/ICO resize)
 *   macOS only: xcrun iconutil            (for true .icns — built-in on macOS)
 *
 * On non-macOS platforms the script writes icon.icns as a copy of the 1024px
 * PNG; electron-builder on macOS will convert it properly during the CI job.
 */

const path = require('path')
const fs   = require('fs')
const os   = require('os')

// ── Sizes required per platform ────────────────────────────────────────────
const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]         // Windows ICO layers
const ICNS_SIZES = {                                       // Apple iconset names
  16:   ['icon_16x16.png'],
  32:   ['icon_16x16@2x.png', 'icon_32x32.png'],
  64:   ['icon_32x32@2x.png'],
  128:  ['icon_128x128.png'],
  256:  ['icon_128x128@2x.png', 'icon_256x256.png'],
  512:  ['icon_256x256@2x.png', 'icon_512x512.png'],
  1024: ['icon_512x512@2x.png'],
}

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons')
const sourceArg = process.argv[2] || path.join(ICONS_DIR, 'icon-1024.png')
const sourcePath = path.resolve(sourceArg)

if (!fs.existsSync(sourcePath)) {
  console.error(`✗  Source not found: ${sourcePath}`)
  console.error('   Place a 1024×1024 PNG at public/icons/icon-1024.png, or pass a path.')
  process.exit(1)
}

// ── Attempt to use sharp ───────────────────────────────────────────────────
let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('✗  sharp is not installed. Run: npm install --save-dev sharp')
  process.exit(1)
}

async function run() {
  console.log(`\n🖼  Generating icons from: ${sourcePath}\n`)
  fs.mkdirSync(ICONS_DIR, { recursive: true })

  // ── 1. PNG set ────────────────────────────────────────────────────────────
  console.log('  PNG sizes:')
  for (const size of PNG_SIZES) {
    const out = path.join(ICONS_DIR, `icon-${size}.png`)
    await sharp(sourcePath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(out)
    process.stdout.write(`    ${size}×${size}  →  icon-${size}.png\n`)
  }

  // Copy 512 as the generic icon.png (used by Linux AppImage)
  fs.copyFileSync(path.join(ICONS_DIR, 'icon-512.png'), path.join(ICONS_DIR, 'icon.png'))
  console.log('    512×512  →  icon.png  (Linux AppImage)')

  // ── 2. ICO (Windows) ──────────────────────────────────────────────────────
  console.log('\n  Building icon.ico (Windows) …')
  // sharp can write ICO natively via toFormat('ico') or via raw pixel concat.
  // The cleanest way is to use the `ico-endec` or `png-to-ico` package if available,
  // otherwise fall back to writing the largest PNG as a stub ICO.
  let icoWritten = false

  try {
    // Try png-to-ico (simpler API)
    const pngToIco = require('png-to-ico')
    const pngBuffers = await Promise.all(
      ICO_SIZES.map(size =>
        sharp(sourcePath)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
      )
    )
    const icoBuffer = await pngToIco(pngBuffers)
    fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer)
    console.log('    icon.ico  ✓  (via png-to-ico)')
    icoWritten = true
  } catch (e) {
    // png-to-ico not installed — just copy the 256px PNG as a placeholder
    fs.copyFileSync(path.join(ICONS_DIR, 'icon-256.png'), path.join(ICONS_DIR, 'icon.ico'))
    console.log('    icon.ico  ⚠  (256px PNG stub — install png-to-ico for a proper ICO)')
    console.log('    npm install --save-dev png-to-ico')
  }

  // ── 3. ICNS (macOS) ───────────────────────────────────────────────────────
  console.log('\n  Building icon.icns (macOS) …')
  if (os.platform() === 'darwin') {
    // Use iconutil (macOS only) for a proper .icns
    const iconsetDir = path.join(os.tmpdir(), 'enput.iconset')
    fs.mkdirSync(iconsetDir, { recursive: true })

    // Write each required iconset size
    for (const [size, names] of Object.entries(ICNS_SIZES)) {
      for (const name of names) {
        const out = path.join(iconsetDir, name)
        await sharp(sourcePath)
          .resize(Number(size), Number(size), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toFile(out)
      }
    }

    const { execSync } = require('child_process')
    const icnsOut = path.join(ICONS_DIR, 'icon.icns')
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsOut}"`)
    fs.rmSync(iconsetDir, { recursive: true, force: true })
    console.log('    icon.icns  ✓  (via iconutil)')
  } else {
    // On Windows/Linux: copy the 1024px PNG; electron-builder on macOS CI will
    // convert it properly via its own iconset pipeline
    fs.copyFileSync(path.join(ICONS_DIR, 'icon-1024.png'), path.join(ICONS_DIR, 'icon.icns'))
    console.log('    icon.icns  ⚠  (1024px PNG stub — proper ICNS built on macOS CI)')
  }

  console.log('\n✅  Done! Icons written to public/icons/\n')
}

run().catch(err => {
  console.error('✗  Icon generation failed:', err.message)
  process.exit(1)
})
