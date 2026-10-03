import { httpUrl } from "./public-url";

export const BIO_THEMES = ["tinte", "papier", "nacht", "koralle", "salbei", "studio", "custom"] as const;
export type BioTheme = (typeof BIO_THEMES)[number];

export const BIO_BUTTONS = ["solid", "glass", "line"] as const;
export type BioButton = (typeof BIO_BUTTONS)[number];

export const BIO_NETWORKS = [
  "instagram",
  "facebook",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "github",
  "spotify",
  "whatsapp",
  "mail",
  "web",
] as const;
export type BioNetwork = (typeof BIO_NETWORKS)[number];

export const BIO_LAYOUTS = ["stack", "grid", "cards"] as const;
export type BioLayout = (typeof BIO_LAYOUTS)[number];
export const BIO_FONTS = ["sans", "display", "serif", "mono"] as const;
export type BioFont = (typeof BIO_FONTS)[number];
export const BIO_SHAPES = ["pill", "round", "square", "squircle"] as const;
export type BioShape = (typeof BIO_SHAPES)[number];
export const BIO_SIZES = ["s", "m", "l"] as const;
export type BioSize = (typeof BIO_SIZES)[number];
export const BIO_HEADERS = ["avatar", "hero", "logo"] as const;
export type BioHeader = (typeof BIO_HEADERS)[number];
export const BIO_KINDS = ["link", "embed", "form", "capture", "subscribe", "booking"] as const;
export type BioKind = (typeof BIO_KINDS)[number] | "heading" | "folder";

export const BIO_ICONS = [
  "link",
  "mail",
  "phone",
  "calendar",
  "pin",
  "bag",
  "music",
  "video",
  "camera",
  "file",
  "star",
  "heart",
  "user",
  "users",
  "gear",
  "tools",
  "cart",
  "message",
  "globe",
  "play",
  "download",
  "ticket",
  "home",
  "spark",
  "mic",
  "book",
  "gift",
  "folder",
  "clock",
  "image",
  "card",
  "lock",
  "send",
  "bell",
  "tag",
  "pen",
  "building",
  "food",
  "coffee",
  "car",
  "headphones",
  "phone2",
  "award",
  "share",
  "bookmark",
  "zap",
] as const;
export type BioIcon = (typeof BIO_ICONS)[number];

export type BioLink = {
  id: string;
  label: string;
  url: string;
  highlight: boolean;
  clicks: number;
  kind: BioKind;
  collection_id: string;
  thumb_url: string | null;
  size: BioSize;
  shape: BioShape;
  spotlight: boolean;
  starts_at: string;
  ends_at: string;
  sensitive: boolean;
  capture: "email" | "phone" | "both";
  rule_devices: string;
  rule_countries: string;
  rule_from: number | null;
  rule_to: number | null;
  icon: string;
  icon_color: string;
  parent_id: string;
};

export type BioCollection = { id: string; title: string };

export type BioSocial = {
  id: string;
  network: BioNetwork;
  url: string;
};

export type BioPage = {
  id: string;
  published: boolean;
  slug: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  logo_url: string | null;
  header: BioHeader;
  bg_image_url: string | null;
  bg_video_url: string | null;
  layout: BioLayout;
  font: BioFont;
  button_shape: BioShape;
  bg_color: string;
  fg_color: string;
  glow_color: string;
  seo_title: string;
  seo_description: string;
  redirect_url: string;
  ga_id: string;
  pixel_id: string;
  sheets_url: string;
  theme: BioTheme;
  button: BioButton;
  line_width: number;
  hide_flag: boolean;
  impressum_url: string;
  privacy_url: string;
  collections: BioCollection[];
  links: BioLink[];
  socials: BioSocial[];
  views: number;
};

export function blankLink(partial?: Partial<BioLink>): BioLink {
  return {
    id: partial?.id || "l0",
    label: partial?.label || "",
    url: partial?.url || "",
    highlight: Boolean(partial?.highlight),
    clicks: partial?.clicks || 0,
    kind: partial?.kind || "link",
    collection_id: partial?.collection_id || "",
    thumb_url: partial?.thumb_url ?? null,
    size: partial?.size || "m",
    shape: partial?.shape || "round",
    spotlight: Boolean(partial?.spotlight),
    starts_at: partial?.starts_at || "",
    ends_at: partial?.ends_at || "",
    sensitive: Boolean(partial?.sensitive),
    capture: partial?.capture || "email",
    rule_devices: partial?.rule_devices || "",
    rule_countries: partial?.rule_countries || "",
    rule_from: partial?.rule_from ?? null,
    rule_to: partial?.rule_to ?? null,
    icon: partial?.icon || "",
    icon_color: partial?.icon_color || "",
    parent_id: partial?.parent_id || "",
  };
}

export const DEFAULT_BIO: BioPage = {
  id: "main",
  published: false,
  slug: "",
  name: "",
  bio: "",
  avatar_url: null,
  logo_url: null,
  header: "avatar",
  bg_image_url: null,
  bg_video_url: null,
  layout: "stack",
  font: "display",
  button_shape: "round",
  bg_color: "",
  fg_color: "",
  glow_color: "",
  seo_title: "",
  seo_description: "",
  redirect_url: "",
  ga_id: "",
  pixel_id: "",
  sheets_url: "",
  theme: "tinte",
  button: "solid",
  line_width: 1,
  hide_flag: false,
  impressum_url: "",
  privacy_url: "",
  collections: [],
  links: [],
  socials: [],
  views: 0,
};

export function paletteFor(page: Pick<BioPage, "theme" | "bg_color" | "fg_color">): BioPalette {
  const base = BIO_PALETTE[page.theme] || BIO_PALETTE.tinte;
  if (page.theme !== "custom") return base;
  const bg = page.bg_color || base.bg;
  const fg = page.fg_color || base.fg;
  return {
    bg,
    fg,
    glow: hexAlpha(fg, 0.34),
    muted: hexAlpha(fg, 0.64),
    accent: fg,
    card: fg,
    cardFg: bg,
    line: hexAlpha(fg, 0.22),
    glass: hexAlpha(isLightHex(bg) ? "#ffffff" : fg, isLightHex(bg) ? 0.55 : 0.12),
  };
}

export function isLightHex(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62;
}

function hexAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export type BioPalette = {
  bg: string;
  glow: string;
  fg: string;
  muted: string;
  accent: string;
  card: string;
  cardFg: string;
  line: string;
  glass: string;
};

export const BIO_PALETTE: Record<BioTheme, BioPalette> = {
  tinte: {
    bg: "#0c0b09",
    glow: "rgba(231,194,122,0.42)",
    fg: "#f6f1e7",
    muted: "rgba(246,241,231,0.64)",
    accent: "#e7c27a",
    card: "#f6f1e7",
    cardFg: "#16140f",
    line: "rgba(246,241,231,0.18)",
    glass: "rgba(246,241,231,0.08)",
  },
  papier: {
    bg: "#f3efe6",
    glow: "rgba(26,95,74,0.28)",
    fg: "#1c1915",
    muted: "rgba(28,25,21,0.62)",
    accent: "#1a5f4a",
    card: "#1c1915",
    cardFg: "#f7f3ea",
    line: "rgba(28,25,21,0.14)",
    glass: "rgba(255,255,255,0.55)",
  },
  nacht: {
    bg: "#070b16",
    glow: "rgba(125,211,252,0.38)",
    fg: "#eef6ff",
    muted: "rgba(238,246,255,0.64)",
    accent: "#7dd3fc",
    card: "#eef6ff",
    cardFg: "#071018",
    line: "rgba(238,246,255,0.16)",
    glass: "rgba(238,246,255,0.08)",
  },
  koralle: {
    bg: "#1a0d12",
    glow: "rgba(251,146,160,0.4)",
    fg: "#fff1f3",
    muted: "rgba(255,241,243,0.66)",
    accent: "#fb7185",
    card: "#fff1f3",
    cardFg: "#2a1016",
    line: "rgba(255,241,243,0.16)",
    glass: "rgba(255,241,243,0.08)",
  },
  salbei: {
    bg: "#0c1411",
    glow: "rgba(167,219,184,0.36)",
    fg: "#eef6f0",
    muted: "rgba(238,246,240,0.64)",
    accent: "#86efac",
    card: "#eef6f0",
    cardFg: "#102017",
    line: "rgba(238,246,240,0.16)",
    glass: "rgba(238,246,240,0.08)",
  },
  studio: {
    bg: "#eceff3",
    glow: "rgba(15,23,42,0.12)",
    fg: "#0f172a",
    muted: "rgba(15,23,42,0.6)",
    accent: "#0f172a",
    card: "#0f172a",
    cardFg: "#f8fafc",
    line: "rgba(15,23,42,0.12)",
    glass: "rgba(255,255,255,0.72)",
  },
  custom: {
    bg: "#141210",
    glow: "rgba(246,241,231,0.28)",
    fg: "#f6f1e7",
    muted: "rgba(246,241,231,0.64)",
    accent: "#f6f1e7",
    card: "#f6f1e7",
    cardFg: "#141210",
    line: "rgba(246,241,231,0.22)",
    glass: "rgba(246,241,231,0.1)",
  },
};

function clampText(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function asNetwork(v: unknown): BioNetwork {
  return (BIO_NETWORKS as readonly string[]).includes(String(v))
    ? (String(v) as BioNetwork)
    : "web";
}

const NETWORK_HOSTS: { network: BioNetwork; host: RegExp }[] = [
  { network: "facebook", host: /(^|\.)((facebook|fb)\.com|fb\.me)$/ },
  { network: "instagram", host: /(^|\.)(instagram\.com|instagr\.am)$/ },
  { network: "x", host: /(^|\.)(x\.com|twitter\.com|t\.co)$/ },
  { network: "linkedin", host: /(^|\.)(linkedin\.com|lnkd\.in)$/ },
  { network: "youtube", host: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { network: "tiktok", host: /(^|\.)tiktok\.com$/ },
  { network: "github", host: /(^|\.)github\.com$/ },
  { network: "spotify", host: /(^|\.)(spotify\.com|spotify\.link)$/ },
  { network: "whatsapp", host: /(^|\.)(wa\.me|whatsapp\.com)$/ },
];

export function networkFromUrl(raw: string): BioNetwork | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^mailto:/i.test(text) || /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(text)) return "mail";
  let host = "";
  try {
    host = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
  if (!host.includes(".")) return null;
  return NETWORK_HOSTS.find((row) => row.host.test(host))?.network ?? (text.includes(".") ? "web" : null);
}

function oneOf<T extends string>(list: readonly T[], v: unknown, fallback: T): T {
  return (list as readonly string[]).includes(String(v)) ? (String(v) as T) : fallback;
}

export function pageGlow(page: Pick<BioPage, "glow_color">, pal: BioPalette): string {
  return /^#[0-9a-f]{6}$/i.test(page.glow_color) ? hexAlpha(page.glow_color, 0.55) : pal.glow;
}

function foldSections(links: BioLink[], collections: BioCollection[]): BioLink[] {
  if (links.some((l) => l.kind === "heading") || collections.length === 0) return links;
  const out = links.filter((l) => !l.collection_id).map((l) => ({ ...l, collection_id: "" }));
  for (const c of collections) {
    const rows = links.filter((l) => l.collection_id === c.id).map((l) => ({ ...l, collection_id: "" }));
    out.push(blankLink({ id: c.id, kind: "heading", label: c.title }));
    out.push(...rows);
  }
  return out.slice(0, 40);
}

export const LINE_WIDTHS = [0.1, 0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30] as const;

export function lineWidth(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return LINE_WIDTHS.reduce((best, step) => (Math.abs(step - n) <= Math.abs(best - n) ? step : best), LINE_WIDTHS[0]);
}

function hourOf(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : null;
}

export function parseBio(raw: unknown): BioPage {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }
  const theme = oneOf(BIO_THEMES, obj.theme, "tinte");
  const button = oneOf(BIO_BUTTONS, obj.button, "solid");
  const links: BioLink[] = [];
  for (const item of Array.isArray(obj.links) ? obj.links : []) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = clampText(rec.url, 2000);
    const label = clampText(rec.label, 80);
    const kind: BioKind =
      rec.kind === "heading" ? "heading" : rec.kind === "folder" ? "folder" : oneOf(BIO_KINDS, rec.kind, "link");
    if (kind !== "heading" && kind !== "folder" && !label && !url && kind === "link") continue;
    links.push(
      blankLink({
        id: clampText(rec.id, 40) || `l${links.length}`,
        label: kind === "heading" || kind === "folder" ? label : label || url,
        url,
        highlight: Boolean(rec.highlight),
        clicks: Math.max(0, Math.floor(Number(rec.clicks) || 0)),
        kind,
        collection_id: clampText(rec.collection_id, 40),
        thumb_url: rec.thumb_url ? clampText(rec.thumb_url, 300) : null,
        size: oneOf(BIO_SIZES, rec.size, "m"),
        shape: oneOf(BIO_SHAPES, rec.shape, "round"),
        spotlight: Boolean(rec.spotlight),
        starts_at: clampText(rec.starts_at, 40),
        ends_at: clampText(rec.ends_at, 40),
        sensitive: Boolean(rec.sensitive),
        capture: rec.capture === "phone" || rec.capture === "both" ? rec.capture : "email",
        rule_devices: clampText(rec.rule_devices, 40),
        rule_countries: clampText(rec.rule_countries, 80).toUpperCase(),
        rule_from: hourOf(rec.rule_from),
        rule_to: hourOf(rec.rule_to),
        icon: (BIO_ICONS as readonly string[]).includes(String(rec.icon)) ? String(rec.icon) : "",
        icon_color: /^#[0-9a-fA-F]{6}$/.test(String(rec.icon_color || "")) ? String(rec.icon_color).toLowerCase() : "",
        parent_id: clampText(rec.parent_id, 40),
      }),
    );
    if (links.length >= 40) break;
  }
  const socials: BioSocial[] = [];
  for (const item of Array.isArray(obj.socials) ? obj.socials : []) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = clampText(rec.url, 2000);
    if (!url) continue;
    socials.push({
      id: clampText(rec.id, 40) || `s${socials.length}`,
      network: asNetwork(rec.network),
      url,
    });
    if (socials.length >= 8) break;
  }
  const collections: BioCollection[] = [];
  for (const item of Array.isArray(obj.collections) ? obj.collections : []) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const title = clampText(rec.title, 60);
    if (!title) continue;
    collections.push({ id: clampText(rec.id, 40) || `c${collections.length}`, title });
    if (collections.length >= 12) break;
  }
  const hex = (v: unknown) => (/^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toLowerCase() : "");
  return {
    id: clampText(obj.id, 40) || "main",
    published: Boolean(obj.published),
    slug: clampText(obj.slug, 48).toLowerCase(),
    name: clampText(obj.name, 80),
    bio: clampText(obj.bio, 280),
    avatar_url: obj.avatar_url ? clampText(obj.avatar_url, 300) : null,
    logo_url: obj.logo_url ? clampText(obj.logo_url, 300) : null,
    header: oneOf(BIO_HEADERS, obj.header, "avatar"),
    bg_image_url: obj.bg_image_url ? clampText(obj.bg_image_url, 300) : null,
    bg_video_url: obj.bg_video_url ? clampText(obj.bg_video_url, 300) : null,
    layout: oneOf(BIO_LAYOUTS, obj.layout, "stack"),
    font: oneOf(BIO_FONTS, obj.font, "display"),
    button_shape: oneOf(BIO_SHAPES, obj.button_shape, "round"),
    bg_color: hex(obj.bg_color),
    fg_color: hex(obj.fg_color),
    glow_color: hex(obj.glow_color),
    seo_title: clampText(obj.seo_title, 70),
    seo_description: clampText(obj.seo_description, 180),
    redirect_url: clampText(obj.redirect_url, 2000),
    ga_id: /^G-[A-Z0-9]+$/.test(String(obj.ga_id || "")) ? String(obj.ga_id) : "",
    pixel_id: /^\d{6,20}$/.test(String(obj.pixel_id || "")) ? String(obj.pixel_id) : "",
    sheets_url: clampText(obj.sheets_url, 400),
    theme,
    button,
    line_width: lineWidth(obj.line_width),
    hide_flag: Boolean(obj.hide_flag),
    impressum_url: httpUrl(clampText(obj.impressum_url, 400)) || "",
    privacy_url: httpUrl(clampText(obj.privacy_url, 400)) || "",
    collections: [],
    links: foldSections(links, collections),
    socials,
    views: Math.max(0, Math.floor(Number(obj.views) || 0)),
  };
}

export type BioStore = { active: string; cards: BioPage[] };

export function parseStore(raw: unknown): BioStore {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.cards) && obj.cards.length) {
    const cards = obj.cards.slice(0, 12).map((c, i) => {
      const page = parseBio(c);
      const rec = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      page.id = clampText(rec.id, 40) || `card${i}`;
      return page;
    });
    const active = cards.some((c) => c.id === String(obj.active)) ? String(obj.active) : cards[0]!.id;
    return { active, cards };
  }
  const page = parseBio(obj);
  return { active: page.id, cards: [page] };
}

export function bioSlugOk(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?$/.test(slug);
}

export function bioHref(raw: string): string | null {
  const v = raw.trim();
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v)) return v;
  if (/^https:\/\/wa\.me\/\d{6,15}$/i.test(v)) return v;
  return httpUrl(v);
}

export const BIO_FONT_STACK: Record<BioFont, string> = {
  sans: '"DM Sans", system-ui, sans-serif',
  display: '"Instrument Sans", "DM Sans", system-ui, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export function shapeRadius(shape: BioShape): number {
  if (shape === "pill") return 999;
  if (shape === "square") return 6;
  if (shape === "squircle") return 28;
  return 18;
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const ch = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [ch(hk + 1 / 3) * 255, ch(hk) * 255, ch(hk - 1 / 3) * 255];
}

function ink(bg: string): string {
  const rgb = hexRgb(bg);
  if (!rgb) return "#111111";
  const [r, g, b] = rgb;
  const lin = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  return L > 0.45 ? "#16140f" : "#f6f1e7";
}

export function suggestColors(hex: string): string[] {
  const rgb = hexRgb(hex);
  if (!rgb) return [];
  const [h, s, l] = rgbHsl(rgb[0], rgb[1], rgb[2]);
  const at = (dh: number, ns: number, nl: number) =>
    rgbHex(...hslRgb(h + dh, Math.min(1, Math.max(0.06, ns)), Math.min(0.94, Math.max(0.08, nl)))).toLowerCase();
  const raw = [
    at(180, Math.max(0.42, s), l > 0.5 ? 0.32 : 0.74),
    at(32, Math.max(0.35, Math.min(0.75, s)), l > 0.55 ? 0.38 : 0.7),
    at(-28, Math.max(0.3, Math.min(0.7, s)), l > 0.5 ? 0.22 : 0.84),
    at(0, 0.08, l > 0.45 ? 0.14 : 0.93),
    at(200, Math.max(0.45, s * 0.9), 0.5),
    at(58, 0.55, l > 0.5 ? 0.3 : 0.76),
  ];
  const skip = hex.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    if (c === skip || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length === 5) break;
  }
  return out;
}

/** Five pairings for a picked color: usable as background or type color. */
export type ColorPair = { bg: string; fg: string; label: string };

export function colorPairings(hex: string): ColorPair[] {
  const rgb = hexRgb(hex);
  if (!rgb) return [];
  const [h, s, l] = rgbHsl(rgb[0], rgb[1], rgb[2]);
  const at = (dh: number, ns: number, nl: number) => rgbHex(...hslRgb(h + dh, Math.min(1, Math.max(0, ns)), Math.min(0.92, Math.max(0.08, nl))));
  const pairs: ColorPair[] = [
    { bg: hex, fg: ink(hex), label: "Fläche" },
    { bg: l > 0.55 ? "#141414" : "#f7f4ee", fg: hex, label: "Schrift" },
    { bg: at(180, Math.max(0.35, s), l > 0.5 ? 0.18 : 0.86), fg: hex, label: "Komplement" },
    { bg: at(28, Math.min(0.55, s), 0.93), fg: at(28, Math.min(0.7, s + 0.1), 0.22), label: "Analog" },
    { bg: at(0, Math.min(0.6, s), 0.16), fg: at(0, Math.min(0.45, s), 0.9), label: "Nacht" },
  ];
  return pairs;
}

export function linkLive(link: BioLink, now = Date.now()): boolean {
  if (link.starts_at) {
    const t = Date.parse(link.starts_at);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (link.ends_at) {
    const t = Date.parse(link.ends_at);
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

export function linkAllowed(
  link: BioLink,
  ctx: { device: string; country: string; hour: number },
): boolean {
  if (!linkLive(link)) return false;
  const devices = link.rule_devices.split(",").map((s) => s.trim()).filter(Boolean);
  if (devices.length && ctx.device && !devices.includes(ctx.device)) return false;
  const countries = link.rule_countries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (countries.length && ctx.country && !countries.includes(ctx.country.toUpperCase())) return false;
  if (link.rule_from != null && link.rule_to != null) {
    const from = link.rule_from;
    const to = link.rule_to;
    const h = ctx.hour;
    const inside = from <= to ? h >= from && h < to : h >= from || h < to;
    if (!inside) return false;
  }
  return true;
}

export function deviceFromUa(ua: string): "ios" | "android" | "desktop" {
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  if (/android/.test(s)) return "android";
  return "desktop";
}

export function embedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
      let id = "";
      if (host === "youtu.be") id = u.pathname.slice(1);
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
      else id = u.searchParams.get("v") || "";
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "open.spotify.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2 && /^(track|album|playlist|episode)$/.test(parts[0]!) && /^[A-Za-z0-9]+$/.test(parts[1]!)) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = (u.pathname.match(/(\d{6,12})/) || [])[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function safeSheetUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    if (host === "metadata.google.internal" || host === "169.254.169.254") return null;
    return u.toString();
  } catch {
    return null;
  }
}
