import QRCode from "qrcode";

export function encodeQrMatrix(text: string, ecc: "M" | "Q" | "H" = "M"): boolean[][] {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecc });
  const size = qr.modules.size;
  const out: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y]![x] = Boolean(qr.modules.get(x, y));
    }
  }
  return out;
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

export type QrDot =
  | "square"
  | "rounded"
  | "dot"
  | "diamond"
  | "triangle"
  | "slash"
  | "backslash"
  | "gap"
  | "beads"
  | "chain"
  | "bar-h"
  | "bar-v"
  | "tile"
  | "arrow"
  | "notch"
  | "blob"
  | "shake"
  | "leaf";

export type QrEye = "square" | "rounded" | "circle" | "octagon";
export type QrFrame = "none" | "corners" | "round";
export type QrLogoMode = "off" | "center" | "behind";

export const QR_DOTS: { id: QrDot; label: string }[] = [
  { id: "square", label: "eckig" },
  { id: "rounded", label: "weich" },
  { id: "dot", label: "punkte" },
  { id: "diamond", label: "raute" },
  { id: "triangle", label: "dreieck" },
  { id: "slash", label: "dia /" },
  { id: "backslash", label: "dia \\" },
  { id: "gap", label: "getrennt" },
  { id: "beads", label: "perlen" },
  { id: "chain", label: "kette" },
  { id: "bar-h", label: "balken –" },
  { id: "bar-v", label: "balken |" },
  { id: "tile", label: "kachel" },
  { id: "arrow", label: "pfeil" },
  { id: "notch", label: "schere" },
  { id: "blob", label: "klecks" },
  { id: "shake", label: "wackel" },
  { id: "leaf", label: "blatt" },
];

export function qrToStyledSvg(
  text: string,
  opts: {
    fg?: string;
    bg?: string;
    dot?: QrDot;
    eye?: QrEye;
    frame?: QrFrame;
    modulePx?: number;
    logo?: string;
    logoMode?: QrLogoMode;
  } = {},
): string {
  const fg = opts.fg || "#111111";
  const bg = opts.bg || "#ffffff";
  const dot = opts.dot || "square";
  const eye = opts.eye || "square";
  const frame = opts.frame || "none";
  const logo = opts.logo || "";
  const logoMode = opts.logoMode || "off";
  const s = opts.modulePx || 10;
  const m = encodeQrMatrix(text, logo && logoMode === "center" ? "H" : "M");
  const quiet = 4;
  const n = m.length;
  const dim = (n + quiet * 2) * s;
  const ox = (x: number) => (x + quiet) * s;
  const oy = (y: number) => (y + quiet) * s;

  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  const punch = logo && logoMode === "center" ? Math.max(5, Math.floor(n * 0.22) | 1) : 0;
  const mid = (n - punch) / 2;
  const inPunch = (x: number, y: number) =>
    punch > 0 && x >= mid && x < mid + punch && y >= mid && y < mid + punch;

  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < n && y < n && !!m[y]![x] && !inFinder(x, y) && !inPunch(x, y);

  let body = "";
  const cell = (x: number, y: number, markup: string) => {
    if (!on(x, y)) return;
    body += markup;
  };

  if (dot === "bar-h") {
    for (let y = 0; y < n; y++) {
      let x = 0;
      while (x < n) {
        if (!on(x, y)) {
          x++;
          continue;
        }
        let x2 = x;
        while (on(x2 + 1, y)) x2++;
        const w = (x2 - x + 1) * s;
        const r = Math.min(s * 0.48, w / 2);
        body += `<rect x="${ox(x)}" y="${oy(y)}" width="${w}" height="${s}" rx="${r}"/>`;
        x = x2 + 1;
      }
    }
  } else if (dot === "bar-v") {
    for (let x = 0; x < n; x++) {
      let y = 0;
      while (y < n) {
        if (!on(x, y)) {
          y++;
          continue;
        }
        let y2 = y;
        while (on(x, y2 + 1)) y2++;
        const h = (y2 - y + 1) * s;
        const r = Math.min(s * 0.48, h / 2);
        body += `<rect x="${ox(x)}" y="${oy(y)}" width="${s}" height="${h}" rx="${r}"/>`;
        y = y2 + 1;
      }
    }
  } else if (dot === "blob") {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!on(x, y)) continue;
        const px = ox(x) + s / 2;
        const py = oy(y) + s / 2;
        body += `<circle cx="${px}" cy="${py}" r="${s * 0.52}"/>`;
        if (on(x + 1, y)) {
          body += `<rect x="${px}" y="${py - s * 0.52}" width="${s}" height="${s * 1.04}"/>`;
        }
        if (on(x, y + 1)) {
          body += `<rect x="${px - s * 0.52}" y="${py}" width="${s * 1.04}" height="${s}"/>`;
        }
      }
    }
  } else {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!on(x, y)) continue;
        const px = ox(x);
        const py = oy(y);
        const cx = px + s / 2;
        const cy = py + s / 2;
        if (dot === "dot" || dot === "beads") {
          cell(x, y, `<circle cx="${cx}" cy="${cy}" r="${s * (dot === "beads" ? 0.38 : 0.42)}"/>`);
        } else if (dot === "rounded") {
          body += `<rect x="${px + s * 0.08}" y="${py + s * 0.08}" width="${s * 0.84}" height="${s * 0.84}" rx="${s * 0.28}"/>`;
        } else if (dot === "diamond") {
          const r = s * 0.46;
          body += `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}"/>`;
        } else if (dot === "triangle") {
          body += `<polygon points="${cx},${py + s * 0.08} ${px + s * 0.92},${py + s * 0.92} ${px + s * 0.08},${py + s * 0.92}"/>`;
        } else if (dot === "slash") {
          const t = s * 0.22;
          body += `<rect x="${px + s * 0.08}" y="${cy - t / 2}" width="${s * 0.84}" height="${t}" rx="${t / 2}" transform="rotate(-45 ${cx} ${cy})"/>`;
        } else if (dot === "backslash") {
          const t = s * 0.22;
          body += `<rect x="${px + s * 0.08}" y="${cy - t / 2}" width="${s * 0.84}" height="${t}" rx="${t / 2}" transform="rotate(45 ${cx} ${cy})"/>`;
        } else if (dot === "gap") {
          const g = s * 0.18;
          body += `<rect x="${px + g}" y="${py + g}" width="${s - g * 2}" height="${s - g * 2}"/>`;
        } else if (dot === "chain") {
          body += `<circle cx="${cx}" cy="${cy}" r="${s * 0.28}"/>`;
          if (on(x + 1, y)) {
            body += `<rect x="${cx}" y="${cy - s * 0.1}" width="${s}" height="${s * 0.2}"/>`;
          }
          if (on(x, y + 1)) {
            body += `<rect x="${cx - s * 0.1}" y="${cy}" width="${s * 0.2}" height="${s}"/>`;
          }
        } else if (dot === "tile") {
          const u = s * 0.38;
          const g = s * 0.08;
          body += `<rect x="${px + g}" y="${py + g}" width="${u}" height="${u}"/>`;
          body += `<rect x="${px + g + u + g}" y="${py + g}" width="${u}" height="${u}"/>`;
          body += `<rect x="${px + g}" y="${py + g + u + g}" width="${u}" height="${u}"/>`;
          body += `<rect x="${px + g + u + g}" y="${py + g + u + g}" width="${u}" height="${u}"/>`;
        } else if (dot === "arrow") {
          const r = s * 0.42;
          body += `<polygon points="${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}"/>`;
        } else if (dot === "notch") {
          const k = s * 0.28;
          body += `<polygon points="${px},${py} ${px + s - k},${py} ${px + s},${py + k} ${px + s},${py + s} ${px + k},${py + s} ${px},${py + s - k}"/>`;
        } else if (dot === "shake") {
          const rot = (((x * 13 + y * 29) % 11) - 5) * 6;
          const inset = s * 0.12;
          body += `<rect x="${px + inset}" y="${py + inset}" width="${s - inset * 2}" height="${s - inset * 2}" transform="rotate(${rot} ${cx} ${cy})"/>`;
        } else if (dot === "leaf") {
          const r = s * 0.5;
          const e = on(x + 1, y);
          const so = on(x, y + 1);
          if (e && so) {
            body += `<rect x="${px}" y="${py}" width="${s}" height="${s}"/>`;
          } else if (e) {
            body += `<path d="M${px} ${py} H${px + s} V${py + s} A${r} ${r} 0 0 1 ${px} ${py} Z"/>`;
          } else if (so) {
            body += `<path d="M${px} ${py} A${r} ${r} 0 0 1 ${px + s} ${py + s} H${px} Z"/>`;
          } else {
            body += `<circle cx="${cx}" cy="${cy}" r="${s * 0.42}"/>`;
          }
        } else {
          body += `<rect x="${px}" y="${py}" width="${s}" height="${s}"/>`;
        }
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
    const x = ox(ex);
    const y = oy(ey);
    const outer = 7 * s;
    const inner = 3 * s;
    if (eye === "circle") {
      const cx = x + outer / 2;
      const cy = y + outer / 2;
      eyesMarkup += `<circle cx="${cx}" cy="${cy}" r="${3.5 * s}" />`;
      eyesMarkup += `<circle cx="${cx}" cy="${cy}" r="${2.5 * s}" fill="${bg}"/>`;
      eyesMarkup += `<circle cx="${cx}" cy="${cy}" r="${1.5 * s}"/>`;
    } else if (eye === "rounded") {
      eyesMarkup += `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="${s * 1.15}"/>`;
      eyesMarkup += `<rect x="${x + s}" y="${y + s}" width="${5 * s}" height="${5 * s}" rx="${s * 0.85}" fill="${bg}"/>`;
      eyesMarkup += `<rect x="${x + 2 * s}" y="${y + 2 * s}" width="${inner}" height="${inner}" rx="${s * 0.55}"/>`;
    } else if (eye === "octagon") {
      const k = s * 1.35;
      const oct = (ox0: number, oy0: number, w: number, cut: number) =>
        `${ox0 + cut},${oy0} ${ox0 + w - cut},${oy0} ${ox0 + w},${oy0 + cut} ${ox0 + w},${oy0 + w - cut} ${ox0 + w - cut},${oy0 + w} ${ox0 + cut},${oy0 + w} ${ox0},${oy0 + w - cut} ${ox0},${oy0 + cut}`;
      eyesMarkup += `<polygon points="${oct(x, y, outer, k)}"/>`;
      eyesMarkup += `<polygon points="${oct(x + s, y + s, 5 * s, k * 0.7)}" fill="${bg}"/>`;
      eyesMarkup += `<polygon points="${oct(x + 2 * s, y + 2 * s, inner, k * 0.4)}"/>`;
    } else {
      eyesMarkup += `<rect x="${x}" y="${y}" width="${outer}" height="${outer}"/>`;
      eyesMarkup += `<rect x="${x + s}" y="${y + s}" width="${5 * s}" height="${5 * s}" fill="${bg}"/>`;
      eyesMarkup += `<rect x="${x + 2 * s}" y="${y + 2 * s}" width="${inner}" height="${inner}"/>`;
    }
  }

  let frameMarkup = "";
  if (frame === "corners") {
    const q = quiet * s;
    const L = s * 3.2;
    const t = s * 0.55;
    const inset = q * 0.35;
    const draw = (x: number, y: number, sx: number, sy: number) => {
      frameMarkup += `<path d="M${x} ${y + L * sy} V${y} H${x + L * sx}" fill="none" stroke="${fg}" stroke-width="${t}" stroke-linecap="square"/>`;
    };
    draw(inset, inset, 1, 1);
    draw(dim - inset, inset, -1, 1);
    draw(inset, dim - inset, 1, -1);
    draw(dim - inset, dim - inset, -1, -1);
  } else if (frame === "round") {
    const inset = quiet * s * 0.4;
    const w = dim - inset * 2;
    frameMarkup += `<rect x="${inset}" y="${inset}" width="${w}" height="${w}" rx="${s * 2.2}" fill="none" stroke="${fg}" stroke-width="${s * 0.45}"/>`;
  }

  let logoMarkup = "";
  if (logo && logoMode !== "off") {
    const safe = logo.replace(/&/g, "&"+"amp;").replace(/"/g, "&"+"quot;");
    if (logoMode === "center" && punch > 0) {
      const pad = s * 0.35;
      const x = ox(mid) + pad;
      const y = oy(mid) + pad;
      const w = punch * s - pad * 2;
      logoMarkup += `<rect x="${ox(mid)}" y="${oy(mid)}" width="${punch * s}" height="${punch * s}" fill="${bg}"/>`;
      logoMarkup += `<image href="${safe}" x="${x}" y="${y}" width="${w}" height="${w}" preserveAspectRatio="xMidYMid meet"/>`;
    } else if (logoMode === "behind") {
      const x = ox(0);
      const y = oy(0);
      const w = n * s;
      logoMarkup += `<image href="${safe}" x="${x}" y="${y}" width="${w}" height="${w}" preserveAspectRatio="xMidYMid slice" opacity="0.92"/>`;
    }
  }

  const behind = logo && logoMode === "behind" ? logoMarkup : "";
  const front = logo && logoMode === "center" ? logoMarkup : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="${bg}"/>${behind}<g fill="${fg}">${body}${eyesMarkup}${frameMarkup}</g>${front}</svg>`;
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

