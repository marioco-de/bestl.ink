import { httpUrl } from "./public-url";

export const BIO_THEMES = ["tinte", "papier", "nacht", "koralle", "salbei", "studio"] as const;
export type BioTheme = (typeof BIO_THEMES)[number];

export const BIO_BUTTONS = ["solid", "glass", "line"] as const;
export type BioButton = (typeof BIO_BUTTONS)[number];

export const BIO_NETWORKS = [
  "instagram",
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

export type BioLink = {
  id: string;
  label: string;
  url: string;
  highlight: boolean;
  clicks: number;
};

export type BioSocial = {
  id: string;
  network: BioNetwork;
  url: string;
};

export type BioPage = {
  published: boolean;
  slug: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  theme: BioTheme;
  button: BioButton;
  hide_flag: boolean;
  links: BioLink[];
  socials: BioSocial[];
  views: number;
};

export const DEFAULT_BIO: BioPage = {
  published: false,
  slug: "",
  name: "",
  bio: "",
  avatar_url: null,
  theme: "tinte",
  button: "solid",
  hide_flag: false,
  links: [],
  socials: [],
  views: 0,
};

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
};

function clampText(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function asNetwork(v: unknown): BioNetwork {
  return (BIO_NETWORKS as readonly string[]).includes(String(v))
    ? (String(v) as BioNetwork)
    : "web";
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
  const theme = (BIO_THEMES as readonly string[]).includes(String(obj.theme))
    ? (String(obj.theme) as BioTheme)
    : "tinte";
  const button = (BIO_BUTTONS as readonly string[]).includes(String(obj.button))
    ? (String(obj.button) as BioButton)
    : "solid";
  const links: BioLink[] = [];
  for (const item of Array.isArray(obj.links) ? obj.links : []) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = clampText(rec.url, 2000);
    const label = clampText(rec.label, 80);
    if (!label && !url) continue;
    links.push({
      id: clampText(rec.id, 40) || `l${links.length}`,
      label: label || url,
      url,
      highlight: Boolean(rec.highlight),
      clicks: Math.max(0, Math.floor(Number(rec.clicks) || 0)),
    });
    if (links.length >= 30) break;
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
  return {
    published: Boolean(obj.published),
    slug: clampText(obj.slug, 48).toLowerCase(),
    name: clampText(obj.name, 80),
    bio: clampText(obj.bio, 280),
    avatar_url: obj.avatar_url ? clampText(obj.avatar_url, 300) : null,
    theme,
    button,
    hide_flag: Boolean(obj.hide_flag),
    links,
    socials,
    views: Math.max(0, Math.floor(Number(obj.views) || 0)),
  };
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
