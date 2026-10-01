// Generates the macOS template tray icons (black + alpha only) at 1x and 2x.
// Run with `node build/make-tray-icons.js` — no dependencies, writes PNGs
// straight into src/renderer/. Template images get their colour from the
// menu bar (light/dark) automatically; only the alpha channel matters.
//
// Shape echoes the InternOps logo mark (three "signal" bars). OFF shows the
// bars faded except the bottom one; ON shows all three solid plus a dot, so
// the two states are distinguishable at a glance even without colour.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

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
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Anti-aliased rounded rectangle / circle coverage via 4x4 supersampling.
function coverage(px, py, shapeFn) {
  let hits = 0;
  for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
    if (shapeFn(px + (sx + 0.5) / 4, py + (sy + 0.5) / 4)) hits++;
  }
  return hits / 16;
}
function roundedRect(x, y, w, h, r) {
  return (px, py) => {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    const cx = Math.max(x + r, Math.min(px, x + w - r));
    const cy = Math.max(y + r, Math.min(py, y + h - r));
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  };
}
function circle(cx, cy, r) {
  return (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function render(size, on) {
  const s = size / 16; // design in a 16pt grid
  const shapes = [
    { fn: roundedRect(3 * s, 11 * s, 10 * s, 2 * s, 1 * s), alpha: 1 },
    { fn: roundedRect(3 * s, 7.5 * s, 7 * s, 2 * s, 1 * s), alpha: on ? 1 : 0.45 },
    { fn: roundedRect(3 * s, 4 * s, 4 * s, 2 * s, 1 * s), alpha: on ? 1 : 0.3 },
  ];
  if (on) shapes.push({ fn: circle(12 * s, 5 * s, 1.6 * s), alpha: 1 });
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = 0;
    for (const sh of shapes) a = Math.max(a, coverage(x, y, sh.fn) * sh.alpha);
    const i = (y * size + x) * 4;
    rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = Math.round(a * 255);
  }
  return encodePng(size, size, rgba);
}

const outDir = path.join(__dirname, "..", "src", "renderer");
fs.writeFileSync(path.join(outDir, "trayTemplate.png"), render(16, false));
fs.writeFileSync(path.join(outDir, "trayTemplate@2x.png"), render(32, false));
fs.writeFileSync(path.join(outDir, "trayOnTemplate.png"), render(16, true));
fs.writeFileSync(path.join(outDir, "trayOnTemplate@2x.png"), render(32, true));
console.log("wrote 4 tray icons to", outDir);
