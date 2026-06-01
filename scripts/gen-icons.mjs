// Dependency-free PWA icon generator.
// Renders an on-brand felt-green icon with a gold spade motif at 192 & 512 px,
// plus an SVG favicon. Run: `node scripts/gen-icons.mjs`.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'web', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// ── colours ───────────────────────────────────────────────────────────────────
const FELT_LIGHT = [0x2d, 0x6a, 0x42];
const FELT_DARK  = [0x16, 0x3d, 0x22];
const GOLD       = [0xd4, 0xa8, 0x43];
const GOLD_DARK  = [0x9c, 0x77, 0x1f];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);

// ── spade shape test in normalised coords (u,v ∈ ~[-1,1], v down) ──────────────
function inTriangle(u, v) {
  const ax = 0, ay = -1.0, bx = -0.95, by = 0.35, cx = 0.95, cy = 0.35;
  const d1 = (u - bx) * (ay - by) - (ax - bx) * (v - by);
  const d2 = (u - cx) * (by - cy) - (bx - cx) * (v - cy);
  const d3 = (u - ax) * (cy - ay) - (cx - ax) * (v - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
const inCircle = (u, v, cx, cy, r) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
function inStem(u, v) {
  if (v < 0.2 || v > 0.8) return false;
  const half = lerp(0.06, 0.4, (v - 0.2) / 0.6);
  return Math.abs(u) <= half;
}
function inSpade(u, v) {
  return inTriangle(u, v) || inCircle(u, v, -0.5, 0.18, 0.5) || inCircle(u, v, 0.5, 0.18, 0.5) || inStem(u, v);
}

// ── render RGBA pixels ─────────────────────────────────────────────────────────
function renderRGBA(size) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = 0.62; // spade half-extent relative to half-icon
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;
      const d = Math.min(1, Math.hypot(nx, ny));
      let [r, g, b] = mix(FELT_LIGHT, FELT_DARK, d); // felt vignette

      const u = nx / scale, v = ny / scale;
      if (inSpade(u, v)) {
        // subtle vertical shading on the gold for depth
        const t = clamp01((v + 1) / 2);
        [r, g, b] = mix(GOLD, GOLD_DARK, t * 0.5);
      }
      const i = (y * size + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return buf;
}

// ── minimal PNG encoder (color type 6, 8-bit) ──────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines with filter byte 0
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── SVG favicon ────────────────────────────────────────────────────────────────
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="#1a472a"/>
  <path d="M50 18 C50 18 78 40 78 58 a14 14 0 0 1 -22 11 c2 8 6 11 9 13 H35 c3 -2 7 -5 9 -13 a14 14 0 0 1 -22 -11 C22 40 50 18 50 18 Z" fill="#d4a843"/>
</svg>`;

for (const size of [192, 512]) {
  const png = encodePng(size, renderRGBA(size));
  writeFileSync(join(OUT, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png (${png.length} bytes)`);
}
writeFileSync(join(OUT, 'icon.svg'), SVG);
console.log('wrote icon.svg');
