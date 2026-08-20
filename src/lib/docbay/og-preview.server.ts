const MAX_HTML = 220_000;
const MAX_IMAGE = 1_800_000;
const UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) bestl.ink/1.0";

function decode(v: string): string {
  return v
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .trim();
}

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const a = html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
    );
    const b = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`,
        "i",
      ),
    );
    const hit = a?.[1] || b?.[1];
    if (hit) return decode(hit);
  }
  return "";
}

function linkHref(html: string, relPart: string): string {
  const a = html.match(
    new RegExp(`<link[^>]+rel=["'][^"']*${relPart}[^"']*["'][^>]*href=["']([^"']+)["']`, "i"),
  );
  const b = html.match(
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*${relPart}[^"']*["']`, "i"),
  );
  return decode(a?.[1] || b?.[1] || "");
}

function titleTag(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return decode(m?.[1] || "");
}

function absUrl(href: string, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function assertPublicHttp(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Ungültige URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Nur http(s)");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    throw new Error("Lokale Adressen sind nicht erlaubt");
  }
  return u;
}

async function fetchBuf(
  url: string,
  max: number,
  accept: string,
): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA, Accept: accept },
    });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") || "").split(";")[0]?.trim() || "";
    const reader = res.body?.getReader();
    if (!reader) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > max) return null;
      return { buf: Buffer.from(ab), mime };
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    return { buf: Buffer.concat(chunks), mime };
  } catch {
    return null;
  }
}

function looksLikeImage(mime: string, buf: Buffer): boolean {
  if (mime.startsWith("image/")) return true;
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50) return true;
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return true;
  if (buf.slice(0, 3).toString() === "GIF") return true;
  return false;
}

export type FetchedOg = {
  title: string;
  description: string;
  imageId: string | null;
  source: "og" | "icon" | "none";
};

export async function fetchOgFromUrl(pageUrl: string): Promise<FetchedOg> {
  const page = assertPublicHttp(pageUrl);
  const htmlHit = await fetchBuf(page.toString(), MAX_HTML, "text/html,application/xhtml+xml");
  const html = htmlHit?.buf.toString("utf8") || "";
  const title =
    metaContent(html, ["og:title", "twitter:title"]) || titleTag(html) || page.hostname;
  const description = metaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]).slice(0, 280);
  const ogImg =
    absUrl(metaContent(html, ["og:image:secure_url", "og:image", "twitter:image"]), page.toString()) ||
    absUrl(linkHref(html, "apple-touch-icon"), page.toString()) ||
    absUrl(linkHref(html, "icon"), page.toString()) ||
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(page.hostname)}&sz=128`;

  let source: FetchedOg["source"] = "none";
  let imageId: string | null = null;
  if (ogImg) {
    try {
      assertPublicHttp(ogImg);
    } catch {
      return { title: title.slice(0, 120), description, imageId: null, source: "none" };
    }
    const img = await fetchBuf(ogImg, MAX_IMAGE, "image/*,*/*;q=0.8");
    if (img && looksLikeImage(img.mime, img.buf)) {
      const { saveOgBlob } = await import("./storage.server");
      const mime = img.mime.startsWith("image/") ? img.mime : "image/jpeg";
      imageId = await saveOgBlob(img.buf, mime);
      const fromOg = Boolean(metaContent(html, ["og:image", "og:image:secure_url", "twitter:image"]));
      source = fromOg ? "og" : "icon";
    }
  }
  return { title: title.slice(0, 120), description, imageId, source };
}

export function ogPublicPath(id: string): string {
  return `/api/og/${id}`;
}
