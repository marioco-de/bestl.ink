export const OG_W = 1200;
export const OG_H = 630;

export type OgFit = "blur" | "crop";

export type CropRect = { sx: number; sy: number; sw: number; sh: number };

export function coverCrop(w: number, h: number, aspect = OG_W / OG_H): CropRect {
  const target = aspect;
  const src = w / h;
  if (src > target) {
    const sw = h * target;
    return { sx: (w - sw) / 2, sy: 0, sw, sh: h };
  }
  const sh = w / target;
  return { sx: 0, sy: (h - sh) / 2, sw: w, sh };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = src;
  });
}

export function composeOg(
  img: HTMLImageElement,
  fit: OgFit,
  crop?: CropRect,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OG_W;
  canvas.height = OG_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas fehlt"));
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, OG_W, OG_H);
  if (fit === "blur") {
    const cover = Math.max(OG_W / img.width, OG_H / img.height) * 1.2;
    const cw = img.width * cover;
    const ch = img.height * cover;
    ctx.filter = "blur(32px) saturate(1.1)";
    ctx.drawImage(img, (OG_W - cw) / 2, (OG_H - ch) / 2, cw, ch);
    ctx.filter = "none";
    const contain = Math.min(OG_W / img.width, OG_H / img.height);
    const dw = img.width * contain;
    const dh = img.height * contain;
    ctx.drawImage(img, (OG_W - dw) / 2, (OG_H - dh) / 2, dw, dh);
  } else {
    const c = crop ?? coverCrop(img.width, img.height);
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, OG_W, OG_H);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("WebP fehlgeschlagen"))),
      "image/webp",
      0.82,
    );
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return btoa(binary);
}

export function fileToUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Datei unlesbar"));
    r.readAsDataURL(file);
  });
}
