// Dependency-free PWA icon generator.
//
// Renders the "Borrowed Hour" app icon — an hourglass running low, in
// rose-gold and cream on a twilight ground — and writes PNGs to public/.
// No native deps: pixels are composited in JS and encoded as PNG with the
// built-in zlib. Re-run with `node scripts/gen-icons.mjs` after tweaking.
//
// Palette mirrors src/styles/theme.css:
//   twilight #0a0814 · twilight-deep #050309 · gloaming #14101e
//   rose-gold #d4a574 · cream #e8dec5 · cream-bright #f4ecd8
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");

// ── colours (linear-ish sRGB byte triples) ──────────────────────────────
const GLOAMING = [20, 16, 30];
const TWILIGHT = [10, 8, 20];
const TWI_DEEP = [5, 3, 9];
const ROSE = [212, 165, 116];
const CREAM = [232, 222, 197];
const CREAM_HI = [244, 236, 216];

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Smooth coverage band: 1 inside, 0 outside, soft across ~`soft` units.
const band = (v, edge, soft) => clamp01((edge - v) / soft + 0.5);

// Sample the icon at normalised coords nx,ny in [-1,1]. Returns [r,g,b].
// `frame` draws the manuscript plate border; `scale` shrinks the hourglass
// (used for the maskable variant so it sits inside the safe zone).
function sample(nx, ny, { frame, scale }) {
  const s = scale || 1;
  const x = nx / s;
  const y = ny / s;
  const ax = Math.abs(x);
  const ay = Math.abs(y);

  // Background: soft radial gradient with two faint colour glows.
  const r = Math.min(1, Math.hypot(nx, ny) / 1.18);
  let col = lerp3(GLOAMING, TWILIGHT, clamp01(r * 1.25));
  col = lerp3(col, TWI_DEEP, clamp01((r - 0.6) / 0.55));
  const glowA = Math.max(0, 1 - Math.hypot(nx + 0.5, ny + 0.55) / 0.95); // violet, upper-left
  col = lerp3(col, [200, 168, 224], glowA * 0.06);
  const glowB = Math.max(0, 1 - Math.hypot(nx - 0.55, ny - 0.6) / 0.95); // rose, lower-right
  col = lerp3(col, ROSE, glowB * 0.05);

  // Hourglass geometry.
  const TOP = 0.6;       // vertical half-extent of the glass body
  const wTop = 0.34;     // half-width at the caps
  const wNeck = 0.04;    // half-width at the pinch
  const OT = 0.03;       // glass outline thickness
  const capH = 0.075;    // cap bar half-height
  const wCap = wTop + 0.05;

  const hw = ay <= TOP ? wNeck + (wTop - wNeck) * (ay / TOP) : -1;

  // Glass interior tint (cool, faint) — reads as glass.
  if (hw > 0 && ax < hw - OT * 0.5) {
    col = lerp3(col, [120, 130, 150], 0.10);
  }

  // ── Sand (cream) ──────────────────────────────────────────────────
  // Bottom mound: fills the lower chamber from the base up.
  if (y > 0 && hw > 0) {
    const moundTop = 0.20 - 0.06 * Math.max(0, 1 - ax / 0.18); // gentle heap at centre
    const cov = band(moundTop, y, 0.02) * band(ax, hw - OT * 0.6, 0.02);
    col = lerp3(col, CREAM, cov);
  }
  // Falling stream at the neck.
  {
    const cov = band(ax, 0.02, 0.012) * band(-y, 0.02, 0.04) * band(y, 0.34, 0.04);
    col = lerp3(col, CREAM_HI, cov * 0.9);
  }
  // Top remnant: a draining funnel of sand just above the neck.
  if (y < 0 && hw > 0) {
    const cov = band(-y, 0.17, 0.02) * band(ax, hw - OT * 0.6, 0.02) * band(0.02, -y, 0.03);
    col = lerp3(col, CREAM, cov * 0.95);
  }

  // ── Glass outline ─────────────────────────────────────────────────
  if (hw > 0) {
    const edge = Math.abs(ax - hw);
    const cov = band(edge, OT, 0.012) * band(ay, TOP + 0.001, 0.012);
    col = lerp3(col, ROSE, cov);
  }
  // Caps (top & bottom bars).
  {
    const cov = band(Math.abs(ay - (TOP + capH * 0.5)), capH * 0.5, 0.012) * band(ax, wCap, 0.02);
    col = lerp3(col, ROSE, cov);
  }

  // ── Plate frame ───────────────────────────────────────────────────
  if (frame) {
    const m = Math.max(Math.abs(nx), Math.abs(ny));
    const cov = band(Math.abs(m - 0.9), 0.012, 0.01);
    col = lerp3(col, ROSE, cov * 0.85);
  }
  return col;
}

// Render at `size` with NxN supersampling for anti-aliasing.
function render(size, opts) {
  const SS = 3;
  const px = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const fx = (i + (si + 0.5) / SS) / size; // 0..1
          const fy = (j + (sj + 0.5) / SS) / size;
          const nx = fx * 2 - 1;
          const ny = fy * 2 - 1;
          const c = sample(nx, ny, opts);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const o = (j * size + i) * 4;
      px[o] = Math.round(clamp01(r / n / 255) * 255);
      px[o + 1] = Math.round(clamp01(g / n / 255) * 255);
      px[o + 2] = Math.round(clamp01(b / n / 255) * 255);
      px[o + 3] = 255;
    }
  }
  return px;
}

// ── PNG encoder (RGBA, 8-bit, filter 0) ──────────────────────────────────
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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let j = 0; j < size; j++) {
    raw[j * (stride + 1)] = 0; // filter: none
    Buffer.from(px.buffer, px.byteOffset + j * stride, stride).copy(raw, j * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(PUBLIC, { recursive: true });
const targets = [
  { file: "icon-192.png", size: 192, opts: { frame: true, scale: 1 } },
  { file: "icon-512.png", size: 512, opts: { frame: true, scale: 1 } },
  { file: "icon-maskable-512.png", size: 512, opts: { frame: false, scale: 0.78 } },
  { file: "apple-touch-icon.png", size: 180, opts: { frame: false, scale: 0.86 } }
];
for (const t of targets) {
  const px = render(t.size, t.opts);
  writeFileSync(join(PUBLIC, t.file), encodePNG(t.size, px));
  console.log(`wrote public/${t.file} (${t.size}×${t.size})`);
}
