import { genToken } from "./id";
import { parseRequireRequest } from "./doc-actions";
import type { JsonObject } from "./types";

export const ACCESS_TOKEN_LEN = 2;
export const CARD_HASH_LEN = 4;

/** http(s) only. Rejects javascript:, data:, and malformed URLs. */
export function httpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function eventStamp(start?: string | null): string {
  if (!start) return "";
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function suggestCardSlug(kind: "event" | "contact", start?: string): string {
  const hash = genToken(CARD_HASH_LEN);
  if (kind === "event") {
    const stamp = eventStamp(start);
    return stamp ? `${stamp}_${hash}` : hash;
  }
  return hash;
}

export function cardKindPath(type: string): "ics" | "vcf" | null {
  if (type === "event") return "ics";
  if (type === "contact") return "vcf";
  return null;
}

export function stripCardExt(slug: string): string {
  return slug.replace(/\.(ics|vcf)$/i, "").replace(/^\//, "");
}

export function isAccessRestricted(opts: {
  requireRequest?: boolean;
  password?: boolean;
  nda?: boolean;
  expires?: boolean;
  oneTime?: boolean;
}): boolean {
  return Boolean(opts.requireRequest || opts.password || opts.nda || opts.expires || opts.oneTime);
}

export function resourceRestricted(
  type: string,
  payload?: JsonObject | null,
  extra?: { password?: boolean; nda?: boolean; expires?: boolean; oneTime?: boolean },
): boolean {
  return isAccessRestricted({
    requireRequest: parseRequireRequest(payload, type),
    password: extra?.password,
    nda: extra?.nda,
    expires: extra?.expires,
    oneTime: extra?.oneTime,
  });
}

export function buildPublicUrl(opts: {
  host: string;
  type: string;
  slug: string;
  token?: string | null;
  restricted: boolean;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
  };
}): string {
  const host = opts.host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const kind = cardKindPath(opts.type);
  const slug = stripCardExt(opts.slug || "link");
  const path = kind ? `/${kind}/${slug}` : slug.includes(".") ? `/${slug}` : `/${slug}/`;
  const p = new URLSearchParams();
  if (opts.restricted && opts.token) p.set("access", opts.token);
  if (opts.utm?.source) p.set("utm_source", opts.utm.source);
  if (opts.utm?.medium) p.set("utm_medium", opts.utm.medium);
  if (opts.utm?.campaign) p.set("utm_campaign", opts.utm.campaign);
  const q = p.toString();
  return `https://${host}${path}${q ? `?${q}` : ""}`;
}