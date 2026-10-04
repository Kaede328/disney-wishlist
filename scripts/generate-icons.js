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

function generateSquarePng(size) {
  const width = size;
  const height = size;
  
  // Row filter 0 (None) + RGBA pixels
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const cx = width / 2;
  const cy = height / 2;

  // Mickey motif parameters (positioned in safe center)
  const headCy = cy + size * 0.05;
  const headR = size * 0.17;

  const earLeftCx = cx - size * 0.14;
  const earLeftCy = cy - size * 0.11;
  const earR = size * 0.105;

  const earRightCx = cx + size * 0.14;
  const earRightCy = cy - size * 0.11;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      // 1. Full-bleed background gradient (top-left #FF7597 to bottom-right #FFA87D)
      // t varies from 0 (top-left) to 1 (bottom-right)
      const t = ((x / width) + (y / height)) / 2;
      const bgR = Math.round(255 - t * 0);
      const bgG = Math.round(117 + t * 51);
      const bgB = Math.round(151 - t * 26);

      // 2. Motif distance check
      const headDx = x - cx;
      const headDy = y - headCy;
      const headDist = Math.sqrt(headDx * headDx + headDy * headDy);

      const earLDx = x - earLeftCx;
      const earLDy = y - earLeftCy;
      const earLDist = Math.sqrt(earLDx * earLDx + earLDy * earLDy);

      const earRDx = x - earRightCx;
      const earRDy = y - earRightCy;
      const earRDist = Math.sqrt(earRDx * earRDx + earRDy * earRDy);

      const isMotif = (headDist <= headR) || (earLDist <= earR) || (earRDist <= earR);

      // Subtle shadow effect (offset: dx=0, dy=+size*0.015)
      const shadowDy = y - (headCy + size * 0.018);
      const shadowHeadDist = Math.sqrt(headDx * headDx + shadowDy * shadowDy);
      const shadowLDy = y - (earLeftCy + size * 0.018);
      const shadowLDist = Math.sqrt(earLDx * earLDx + shadowLDy * shadowLDy);
      const shadowRDy = y - (earRightCy + size * 0.018);
      const shadowRDist = Math.sqrt(earRDx * earRDx + shadowRDy * shadowRDy);
      const isShadow = (shadowHeadDist <= headR + 2) || (shadowLDist <= earR + 2) || (shadowRDist <= earR + 2);

      if (isMotif) {
        // Pure crisp white motif
        rawData[offset++] = 255;
        rawData[offset++] = 255;
        rawData[offset++] = 255;
        rawData[offset++] = 255; // 100% opaque
      } else if (isShadow && y > cy) {
        // Soft warm shadow
        rawData[offset++] = Math.round(bgR * 0.85);
        rawData[offset++] = Math.round(bgG * 0.78);
        rawData[offset++] = Math.round(bgB * 0.82);
        rawData[offset++] = 255; // 100% opaque
      } else {
        // Full bleed background: NO transparency, 100% opaque
        rawData[offset++] = bgR;
        rawData[offset++] = bgG;
        rawData[offset++] = bgB;
        rawData[offset++] = 255; // 100% opaque
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

// Generate full-bleed square PNGs
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generateSquarePng(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generateSquarePng(512));
fs.writeFileSync(path.join(publicDir, 'icon-maskable-512.png'), generateSquarePng(512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generateSquarePng(180));
console.log('Square full-bleed PNG icons generated successfully.');
