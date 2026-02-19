/**
 * Packages the Davos TP plugin into a .tpp file (renamed zip).
 * Run: node scripts/package.js
 * Output: DavosTPplugin.tpp in the project root
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'DavosTPplugin.tpp');

// Files to include (relative to project root)
const INCLUDE = [
  'entry.tp',
  'index.js',
  'package.json',
  'icon.png',
  'node_modules',
];

// Check for node.exe bundled copy
const nodeExeSrc = process.execPath;
const nodeExeDst = path.join(ROOT, 'node.exe');

console.log('Packaging Davos TP Plugin...');

// Copy node.exe if not present
if (!fs.existsSync(nodeExeDst)) {
  console.log(`Copying node.exe from ${nodeExeSrc}`);
  fs.copyFileSync(nodeExeSrc, nodeExeDst);
} else {
  console.log('node.exe already present');
}

INCLUDE.push('node.exe');

// Build the zip using PowerShell (Windows)
const files = INCLUDE
  .filter(f => fs.existsSync(path.join(ROOT, f)))
  .map(f => `"${path.join(ROOT, f)}"`)
  .join(', ');

// Create a temp folder structure: DavosTPplugin/
const tmpDir = path.join(ROOT, '_pkg_tmp');
const pluginDir = path.join(tmpDir, 'DavosTPplugin');

if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
fs.mkdirSync(pluginDir, { recursive: true });

// Copy files
for (const f of INCLUDE) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) {
    console.warn(`  Skipping missing: ${f}`);
    continue;
  }
  const dst = path.join(pluginDir, f);
  copyRecursive(src, dst);
  console.log(`  + ${f}`);
}

// Zip with PowerShell
if (fs.existsSync(OUTPUT)) fs.unlinkSync(OUTPUT);
const cmd = `powershell -Command "Compress-Archive -Path '${pluginDir}' -DestinationPath '${OUTPUT.replace('.tpp', '.zip')}' -Force"`;
execSync(cmd);
fs.renameSync(OUTPUT.replace('.tpp', '.zip'), OUTPUT);

// Cleanup
fs.rmSync(tmpDir, { recursive: true });

console.log(`\nDone: ${OUTPUT}`);
console.log('Import DavosTPplugin.tpp into Touch Portal to install.');

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dst, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
