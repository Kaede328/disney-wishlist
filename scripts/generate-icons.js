import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const publicDir = path.resolve('public');
const sourceJpg = path.join(publicDir, 'icon.jpg');

if (!fs.existsSync(sourceJpg)) {
  console.error('Source icon.jpg not found in public directory');
  process.exit(1);
}

const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'icon.png', size: 64 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'favicon-16x16.png', size: 16 },
  { file: 'favicon.ico', size: 32 },
];

for (const target of targets) {
  const destPath = path.join(publicDir, target.file);
  execSync(`convert "${sourceJpg}" -resize ${target.size}x${target.size} "${destPath}"`);
  console.log(`Generated ${target.file} (${target.size}x${target.size})`);
}

// Generate self-contained icon.svg
const tmpJpg = '/tmp/icon-512.jpg';
execSync(`convert "${sourceJpg}" -resize 512x512 -quality 85 "${tmpJpg}"`);
const b64 = fs.readFileSync(tmpJpg).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
  <image width="512" height="512" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/jpeg;base64,${b64}" href="data:image/jpeg;base64,${b64}"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg);
console.log('Generated self-contained icon.svg');
console.log('All icons synchronized successfully from icon.jpg.');
