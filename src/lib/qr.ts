/**
 * Compact QR encoder (byte mode, ECC M, versions 1–10).
 * Good for typical short URLs and titles.
 */

const ECC_M_CW = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const ECC_M_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const TOTAL_CW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

function gfMul(a: number, b: number): number {
  if (!a || !b) return 0;
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1d;
    b >>= 1;
  }
  return p;
}

function rsGenerator(ec: number): number[] {
  let g = [1];
  let root = 1;
  for (let i = 0; i < ec; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= gfMul(g[j], root);
      next[j + 1] ^= g[j];
    }
    g = next;
    root = gfMul(root, 2);
  }
  return g;
}

function rsEncode(data: number[], ec: number): number[] {
  const g = rsGenerator(ec);
  const out = data.concat(new Array(ec).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = out[i]!;
    if (!coef) continue;
    for (let j = 0; j < g.length; j++) out[i + j]! ^= gfMul(g[j]!, coef);
  }
  return out.slice(data.length);
}

function bitPush(bits: number[], val: number, n: number) {
  for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
}

function chooseVersion(len: number): number {
  for (let v = 1; v <= 10; v++) {
    const ec = ECC_M_CW[v]!;
    const dataCw = TOTAL_CW[v]! - ec;
    const cap = dataCw - 2 - (v >= 10 ? 1 : 0);
    if (len + 2 <= cap) return v;
  }
  throw new Error("Text zu lang für QR");
}

function alignmentCoords(v: number): number[] {
  if (v === 1) return [];
  const last = 4 * v + 10;
  if (v <= 6) return [6, last];
  const n = Math.floor(v / 7) + 2;
  const step = Math.ceil((last - 6) / (n - 1) / 2) * 2;
  const pos = [6];
  for (let i = n - 2; i >= 1; i--) pos.push(last - i * step);
  pos.push(last);
  return pos;
}

function placeFinder(m: number[][], x: number, y: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = y + r;
      const cc = x + c;
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      const on =
        r >= 0 &&
        r <= 6 &&
        c >= 0 &&
        c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      m[rr]![cc] = on ? 1 : 0;
    }
  }
}

function reserved(size: number, v: number): boolean[][] {
  const r = Array.from({ length: size }, () => Array(size).fill(false));
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < size && y < size) r[y]![x] = true;
  };
  const box = (x: number, y: number, w: number, h: number) => {
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) mark(x + j, y + i);
  };
  box(0, 0, 9, 9);
  box(size - 8, 0, 8, 9);
  box(0, size - 8, 9, 8);
  const al = alignmentCoords(v);
  for (const ay of al) {
    for (const ax of al) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === 4 * v + 10) || (ax === 4 * v + 10 && ay === 6))
        continue;
      box(ax - 2, ay - 2, 5, 5);
    }
  }
  for (let i = 8; i < size - 8; i++) {
    mark(i, 6);
    mark(6, i);
  }
  if (v >= 7) {
    box(0, size - 11, 6, 3);
    box(size - 11, 0, 3, 6);
  }
  return r;
}

function maskFn(id: number, r: number, c: number): boolean {
  switch (id) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask; // ECC M = 00
  let d = data << 10;
  const poly = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((d >> i) & 1) d ^= poly << (i - 10);
  }
  return (data << 10 | d) ^ 0b101010000010010;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const v = chooseVersion(bytes.length);
  const size = 21 + (v - 1) * 4;
  const total = TOTAL_CW[v]!;
  const ecTotal = ECC_M_CW[v]!;
  const dataCw = total - ecTotal;
  const nBlocks = ECC_M_BLOCKS[v]!;
  const shortBlocks = nBlocks - (dataCw % nBlocks);
  const shortLen = Math.floor(dataCw / nBlocks);

  const bits: number[] = [];
  bitPush(bits, 0b0100, 4);
  bitPush(bits, bytes.length, v >= 10 ? 16 : 8);
  for (const b of bytes) bitPush(bits, b, 8);
  const maxBits = dataCw * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let n = 0;
    for (let j = 0; j < 8; j++) n = (n << 1) | (bits[i + j] || 0);
    data.push(n);
  }
  const pads = [0xec, 0x11];
  let p = 0;
  while (data.length < dataCw) data.push(pads[p++ % 2]!);

  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  const ecLen = Math.floor(ecTotal / nBlocks);
  let off = 0;
  for (let i = 0; i < nBlocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1);
    const blk = data.slice(off, off + len);
    off += len;
    blocks.push(blk);
    ecBlocks.push(rsEncode(blk, ecLen));
  }
  const interleaved: number[] = [];
  const maxD = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxD; i++) {
    for (const b of blocks) if (i < b.length) interleaved.push(b[i]!);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of ecBlocks) interleaved.push(b[i]!);
  }

  const matrix = Array.from({ length: size }, () => Array(size).fill(0));
  const res = reserved(size, v);
  placeFinder(matrix, 0, 0);
  placeFinder(matrix, size - 7, 0);
  placeFinder(matrix, 0, size - 7);
  const als = alignmentCoords(v);
  for (const ay of als) {
    for (const ax of als) {
      if ((ax <= 8 && ay <= 8) || (ax >= size - 9 && ay <= 8) || (ax <= 8 && ay >= size - 9))
        continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          matrix[ay + r]![ax + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0;
        }
      }
    }
  }
  for (let i = 8; i < size - 8; i++) {
    matrix[6]![i] = i % 2 === 0 ? 1 : 0;
    matrix[i]![6] = i % 2 === 0 ? 1 : 0;
  }
  matrix[4 * v + 9]![8] = 1; // dark module

  const stream: number[] = [];
  for (const b of interleaved) {
    for (let i = 7; i >= 0; i--) stream.push((b >> i) & 1);
  }

  let best: number[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = matrix.map((row) => row.slice());
    let bi = 0;
    let col = size - 1;
    let up = true;
    while (col > 0) {
      if (col === 6) col--;
      for (let i = 0; i < size; i++) {
        const y = up ? size - 1 - i : i;
        for (let dx = 0; dx < 2; dx++) {
          const x = col - dx;
          if (res[y]![x]) continue;
          const bit = stream[bi++] || 0;
          m[y]![x] = bit ^ (maskFn(mask, y, x) ? 1 : 0);
        }
      }
      up = !up;
      col -= 2;
    }
    const fmt = formatBits(mask);
    const positions: [number, number][] = [];
    for (let i = 0; i < 6; i++) positions.push([8, i]);
    positions.push([8, 7], [8, 8], [7, 8]);
    for (let i = 5; i >= 0; i--) positions.push([i, 8]);
    for (let i = 0; i < 8; i++) m[positions[i]![1]]![positions[i]![0]] = (fmt >> (14 - i)) & 1;
    for (let i = 0; i < 8; i++) m[8]![size - 1 - i] = (fmt >> (14 - i)) & 1;
    for (let i = 0; i < 7; i++) m[size - 7 + i]![8] = (fmt >> (6 - i)) & 1;

    let score = 0;
    for (let y = 0; y < size; y++) {
      let run = 1;
      for (let x = 1; x < size; x++) {
        if (m[y]![x] === m[y]![x - 1]) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return (best ?? matrix).map((row) => row.map((c) => c === 1));
}

export function qrToSvg(text: string, modulePx = 8): string {
  const m = encodeQrMatrix(text);
  const quiet = 4;
  const n = m.length;
  const dim = (n + quiet * 2) * modulePx;
  let rects = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y]![x]) {
        rects += `<rect x="${(x + quiet) * modulePx}" y="${(y + quiet) * modulePx}" width="${modulePx}" height="${modulePx}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}

export type QrDot = "square" | "rounded" | "dot" | "diamond";
export type QrEye = "square" | "rounded" | "circle";

export function qrToStyledSvg(
  text: string,
  opts: {
    fg?: string;
    bg?: string;
    dot?: QrDot;
    eye?: QrEye;
    modulePx?: number;
  } = {},
): string {
  const fg = opts.fg || "#111111";
  const bg = opts.bg || "#ffffff";
  const dot = opts.dot || "square";
  const eye = opts.eye || "square";
  const s = opts.modulePx || 10;
  const m = encodeQrMatrix(text);
  const quiet = 4;
  const n = m.length;
  const dim = (n + quiet * 2) * s;

  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  let body = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!m[y]![x] || inFinder(x, y)) continue;
      const px = (x + quiet) * s;
      const py = (y + quiet) * s;
      if (dot === "dot") {
        body += `<circle cx="${px + s / 2}" cy="${py + s / 2}" r="${s * 0.42}"/>`;
      } else if (dot === "rounded") {
        body += `<rect x="${px + s * 0.08}" y="${py + s * 0.08}" width="${s * 0.84}" height="${s * 0.84}" rx="${s * 0.28}"/>`;
      } else if (dot === "diamond") {
        const cx = px + s / 2;
        const cy = py + s / 2;
        const r = s * 0.46;
        body += `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}"/>`;
      } else {
        body += `<rect x="${px}" y="${py}" width="${s}" height="${s}"/>`;
      }
    }
  }

  const eyes = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ] as const;
  let eyesMarkup = "";
  for (const [ex, ey] of eyes) {
    const ox = (ex + quiet) * s;
    const oy = (ey + quiet) * s;
    const outer = 7 * s;
    const mid = 5 * s;
    const inner = 3 * s;
    if (eye === "circle") {
      const cx = ox + outer / 2;
      const cy = oy + outer / 2;
      eyesMarkup += `<circle cx="${cx}" cy="${cy}" r="${3.5 * s}" />`;
      eyesMarkup += `<circle cx="${cx}" cy="${cy}" r="${2.5 * s}" fill="${bg}"/>`;
      eyesMarkup += `<circle cx="${cx}" cy="${cy}" r="${1.5 * s}"/>`;
    } else if (eye === "rounded") {
      const r1 = s * 1.15;
      const r2 = s * 0.85;
      const r3 = s * 0.55;
      eyesMarkup += `<rect x="${ox}" y="${oy}" width="${outer}" height="${outer}" rx="${r1}"/>`;
      eyesMarkup += `<rect x="${ox + s}" y="${oy + s}" width="${5 * s}" height="${5 * s}" rx="${r2}" fill="${bg}"/>`;
      eyesMarkup += `<rect x="${ox + 2 * s}" y="${oy + 2 * s}" width="${inner}" height="${inner}" rx="${r3}"/>`;
    } else {
      eyesMarkup += `<rect x="${ox}" y="${oy}" width="${outer}" height="${outer}"/>`;
      eyesMarkup += `<rect x="${ox + s}" y="${oy + s}" width="${5 * s}" height="${5 * s}" fill="${bg}"/>`;
      eyesMarkup += `<rect x="${ox + 2 * s}" y="${oy + 2 * s}" width="${inner}" height="${inner}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="${bg}"/><g fill="${fg}">${body}${eyesMarkup}</g></svg>`;
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const h =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function qrContrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg"));
    };
    img.src = url;
  });
}

export async function validateQrReadable(opts: {
  text: string;
  svg: string;
  fg: string;
  bg: string;
}): Promise<boolean> {
  if (!opts.text || !opts.svg) return false;
  if (qrContrast(opts.fg, opts.bg) < 3) return false;
  try {
    const matrix = encodeQrMatrix(opts.text);
    const img = await loadSvgImage(opts.svg);
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const n = matrix.length;
    const quiet = 4;
    const mod = size / (n + quiet * 2);
    const fgL = luminance(opts.fg);
    const bgL = luminance(opts.bg);
    const mid = (fgL + bgL) / 2;
    const darkIsFg = fgL < bgL;
    let ok = 0;
    let total = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = Math.floor((x + quiet + 0.5) * mod);
        const py = Math.floor((y + quiet + 0.5) * mod);
        const i = (py * size + px) * 4;
        const r = data[i]! / 255;
        const g = data[i + 1]! / 255;
        const b = data[i + 2]! / 255;
        const lin = (c: number) =>
          c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const isDark = L < mid;
        const isOn = darkIsFg ? isDark : !isDark;
        if (isOn === matrix[y]![x]) ok++;
        total++;
      }
    }
    return total > 0 && ok / total >= 0.86;
  } catch {
    return false;
  }
}

export function downloadSvgFile(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadQrRaster(svg: string, type: "png" | "jpeg", filename: string) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (type === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
    }
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      type === "png" ? "image/png" : "image/jpeg",
      0.92,
    );
  };
  img.src = url;
}

