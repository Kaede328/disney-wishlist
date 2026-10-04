import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  // Pastel gradient with Disney Castle & Mickey silhouette
  const width = size;
  const height = size;
  
  // Row filter 0 (None) + RGBA pixels
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.44;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background pastel circle: #FFF8F0 to #FFE8EC
      if (dist <= r) {
        // Pastel Disney pink/coral gradient
        const t = (y / height);
        // Base pink: 255, 142, 170 (#FF8EAA)
        // Light pastel: 255, 204, 217
        const rVal = Math.round(255 - t * 15);
        const gVal = Math.round(145 + t * 45);
        const bVal = Math.round(175 + t * 40);

        // Simple Mickey silhouette check in center
        // Center head: cy + 10%, radius 0.20 * size
        const headDy = y - (cy + size * 0.04);
        const headDist = Math.sqrt(dx * dx + headDy * headDy);
        // Ears:
        const earLeftDx = x - (cx - size * 0.17);
        const earLeftDy = y - (cy - size * 0.14);
        const earLeftDist = Math.sqrt(earLeftDx * earLeftDx + earLeftDy * earLeftDy);

        const earRightDx = x - (cx + size * 0.17);
        const earRightDy = y - (cy - size * 0.14);
        const earRightDist = Math.sqrt(earRightDx * earRightDx + earRightDy * earRightDy);

        if (headDist <= size * 0.18 || earLeftDist <= size * 0.11 || earRightDist <= size * 0.11) {
          // Silhouette: clean soft white #FFFFFF
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 245;
        } else {
          rawData[offset++] = rVal;
          rawData[offset++] = gVal;
          rawData[offset++] = bVal;
          rawData[offset++] = 255;
        }
      } else {
        // Outside circle: transparent or corner soft color
        rawData[offset++] = 255;
        rawData[offset++] = 255;
        rawData[offset++] = 255;
        rawData[offset++] = 0;
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: 0 (deflate)
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0

  const compressedData = zlib.deflateSync(rawData);

  const pngBuffer = Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressedData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);

  return pngBuffer;
}

// Generate PNGs
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generatePng(512));
fs.writeFileSync(path.join(publicDir, 'icon-maskable-512.png'), generatePng(512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180));
console.log('PNG icons generated successfully.');
