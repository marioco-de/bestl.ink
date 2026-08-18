import { PLATFORM_LINK_HOST } from "./brand";
import type { FullState } from "./types";

export function orderedHosts(data: FullState): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  const add = (raw?: string | null) => {
    const h = (raw || "").trim().toLowerCase();
    if (!h || seen.has(h)) return;
    seen.add(h);
    hosts.push(h);
  };
  const domains = [...(data.domains ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  for (const d of domains) add(d.host);
  add(data.tenant.custom_domain);
  add(data.tenant.public_host);
  if (data.tenant.subdomain) add(`${data.tenant.subdomain}.${PLATFORM_LINK_HOST}`);
  add(PLATFORM_LINK_HOST);
  return hosts;
}

export function defaultHost(data: FullState): string {
  return orderedHosts(data)[0] || PLATFORM_LINK_HOST;
}

export function withHttp(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Absolute http(s) URL, or null. Never a relative path. */
export function absoluteHttpUrl(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t || t.startsWith("/") || t.startsWith("#") || t.startsWith("?")) return null;
  const href = /^https?:\/\//i.test(t) ? t : t.startsWith("//") ? `https:${t}` : `https://${t}`;
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
