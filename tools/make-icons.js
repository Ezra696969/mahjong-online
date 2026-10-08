'use strict';
// Membuat ikon PWA (PNG) tanpa dependensi: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// jarak bertanda ke persegi bersudut bulat (negatif = di dalam)
function sdRR(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r), qy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

function render(size, { rounded }) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;
  const tw = 0.23 * size, th = 0.30 * size; // setengah lebar/tinggi ubin
  const cx = size / 2, cy = size / 2 - 0.01 * size;
  const edge = hex('#1e7b52'), ivory = hex('#f6efd5'), red = hex('#c0392b');
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = px + (sx + 0.5) / SS, y = py + (sy + 0.5) / SS;
      let col = null, alpha = 1;
      if (rounded && sdRR(x, y, size / 2, size / 2, size / 2, size / 2, size * 0.22) > 0) alpha = 0;
      else {
        const d = Math.hypot(x - size / 2, y - size * 0.42) / size; // latar felt bergradasi
        const t = Math.min(1, d * 1.5);
        col = [20 + (8 - 20) * t, 128 + (57 - 128) * t, 90 + (42 - 90) * t];
        if (sdRR(x, y, cx, cy + 0.028 * size, tw, th, 0.06 * size) < 0) col = edge;
        if (sdRR(x, y, cx, cy, tw, th, 0.06 * size) < 0) {
          col = ivory;
          const gx = Math.abs(x - cx), gy = y - cy, s = 0.034 * size;
          const bw = tw * 0.62, bh = th * 0.40, by = cy - th * 0.08;
          const box = Math.abs(gx - bw) < s && Math.abs(y - by) < bh + s || Math.abs(y - (by - bh)) < s && gx < bw + s || Math.abs(y - (by + bh)) < s && gx < bw + s;
          const bar = gx < s && Math.abs(gy) < th * 0.72;
          if (box || bar) col = red;
        }
      }
      if (alpha) { r += col[0]; g += col[1]; b += col[2]; a += 1; }
    }
    const n = SS * SS, i = (py * size + px) * 4;
    buf[i] = a ? r / a : 0; buf[i + 1] = a ? g / a : 0; buf[i + 2] = a ? b / a : 0; buf[i + 3] = Math.round((a / n) * 255);
  }
  return png(size, size, buf);
}

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), render(192, { rounded: true }));
fs.writeFileSync(path.join(out, 'icon-512.png'), render(512, { rounded: true }));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), render(512, { rounded: false }));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), render(180, { rounded: false }));
console.log('ikon dibuat di', out);
