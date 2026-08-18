import { writeActivity } from "./activity.server";
import { getSql } from "@/lib/db";
import type { ApiKeyRow, ShortLink } from "./types";
import {
  uid,
  genToken,
  hashSecret,
  verifySecret,
  isBotUa,
  parseJsonArray,
  parseJsonObj,
} from "./id";
import { splitRuleMatches, unpackSplitRules } from "./device-split";

export const RESERVED_SLUGS = new Set([
  "control",
  "login",
  "signup",
  "api",
  "super",
  "auth",
  "go",
  "s",
  "l",
]);

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export function parseUa(ua: string): { device: string; os: string; browser: string } {
  const device = /ipad|tablet/i.test(ua)
    ? "tablet"
    : /mobi|android/i.test(ua)
      ? "mobile"
      : "desktop";
  const os = /iphone|ipad|ipod/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /mac os x/i.test(ua)
        ? "macOS"
        : /windows/i.test(ua)
          ? "Windows"
          : /linux/i.test(ua)
            ? "Linux"
            : "Other";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
      ? "Chrome"
      : /firefox\//i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Other";
  return { device, os, browser };
}

export function isOgBot(ua: string): boolean {
  return /twitterbot|facebookexternalhit|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|pinterest|skypeuripreview|vkshare|embedly|quora link preview|outbrain|w3c_validator|whatsapp|preview/i.test(
    ua,
  );
}

export function countryFromHeaders(h: {
  cf?: string | null;
  vercel?: string | null;
  lang?: string | null;
}): string {
  const c = (h.cf || h.vercel || "").toUpperCase();
  if (c && c !== "XX" && c.length === 2) return c;
  const lang = (h.lang || "").split(",")[0] || "";
  const m = lang.match(/[-_]([A-Z]{2})\b/i);
  return m ? m[1]!.toUpperCase() : "";
}

export function mapShortRow(r: Record<string, unknown>): ShortLink {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    slug: String(r.slug),
    destination: String(r.destination),
    title: String(r.title ?? ""),
    note: String(r.note ?? ""),
    tags: parseJsonArray(r.tags),
    has_password: Boolean(r.password_hash || r.has_password),
    expires_at: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    max_clicks: r.max_clicks != null ? Number(r.max_clicks) : null,
    disabled: Boolean(r.disabled),
    cloak: Boolean(r.cloak),
    ios_url: r.ios_url ? String(r.ios_url) : null,
    android_url: r.android_url ? String(r.android_url) : null,
    geo_rules: Object.fromEntries(
      Object.entries(parseJsonObj(r.geo_rules)).map(([k, v]) => [k, String(v)]),
    ),
    og_title: r.og_title ? String(r.og_title) : null,
    og_description: r.og_description ? String(r.og_description) : null,
    og_image: r.og_image ? String(r.og_image) : null,
    button_id: r.button_id ? String(r.button_id) : null,
    button_name: r.button_name ? String(r.button_name) : undefined,
    utm_source: r.utm_source ? String(r.utm_source) : null,
    utm_medium: r.utm_medium ? String(r.utm_medium) : null,
    utm_campaign: r.utm_campaign ? String(r.utm_campaign) : null,
    click_count: Number(r.click_count ?? 0),
    human_click_count: Number(r.human_click_count ?? 0),
    last_clicked_at: r.last_clicked_at
      ? new Date(r.last_clicked_at as string).toISOString()
      : null,
    created_at: new Date(r.created_at as string).toISOString(),
  };
}

export async function listApiKeys(tenantId: string): Promise<ApiKeyRow[]> {
  const sql = await getSql();
  const rows = await sql`
    select id, tenant_id, name, prefix, created_at
    from db_api_keys where tenant_id = ${tenantId}
    order by created_at desc
  `;
  return rows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      tenant_id: String(x.tenant_id),
      name: String(x.name),
      prefix: String(x.prefix),
      created_at: new Date(x.created_at as string).toISOString(),
    };
  });
}

export async function slugTaken(
  tenantId: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const sql = await getSql();
  if (RESERVED_SLUGS.has(slug)) return true;
  const res = await sql`
    select id from db_resources where tenant_id = ${tenantId} and slug = ${slug} limit 1
  `;
  if (res.length) return true;
  const sh = exceptId
    ? await sql`
        select id from db_short_links
        where tenant_id = ${tenantId} and slug = ${slug} and id <> ${exceptId}
        limit 1
      `
    : await sql`
        select id from db_short_links
        where tenant_id = ${tenantId} and slug = ${slug}
        limit 1
      `;
  return sh.length > 0;
}

export async function uniqueSlug(tenantId: string): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const s = genToken(5);
    if (!(await slugTaken(tenantId, s))) return s;
  }
  return genToken(8);
}

export function applyUtm(url: string, s: ShortLink): string {
  try {
    const u = new URL(url);
    if (s.utm_source) u.searchParams.set("utm_source", s.utm_source);
    if (s.utm_medium) u.searchParams.set("utm_medium", s.utm_medium);
    if (s.utm_campaign) u.searchParams.set("utm_campaign", s.utm_campaign);
    return u.toString();
  } catch {
    return url;
  }
}

export function pickDestination(
  s: ShortLink,
  ua: string,
  country: string,
): string {
  const parsed = parseUa(ua);
  for (const rule of unpackSplitRules(s)) {
    if (splitRuleMatches(rule, parsed, country)) return applyUtm(rule.url, s);
  }
  return applyUtm(s.destination, s);
}

export async function findShortBySlug(
  slug: string,
  host?: string,
): Promise<(ShortLink & { brand_company: string; brand_color: string; public_host: string }) | null> {
  const sql = await getSql();
  const h = (host || "").toLowerCase().replace(/:\d+$/, "");
  let rows: unknown[] = [];
  if (h) {
    rows = await sql`
      select s.*, p.name as button_name, t.brand_company, t.brand_color,
             t.subdomain, t.custom_domain, t.custom_domain_connected, t.domain
      from db_short_links s
      join db_tenants t on t.id = s.tenant_id
      left join db_param_nodes p on p.id = s.button_id
      where s.slug = ${slug}
        and (
          lower(t.custom_domain) = ${h}
          or lower(t.domain) = ${h}
          or t.subdomain = ${h.split(".")[0] ?? ""}
          or exists (
            select 1 from db_tenant_domains d
            where d.tenant_id = t.id and lower(d.host) = ${h}
          )
        )
      limit 1
    `;
  }
  if (rows.length === 0) {
    rows = await sql`
      select s.*, p.name as button_name, t.brand_company, t.brand_color,
             t.subdomain, t.custom_domain, t.custom_domain_connected, t.domain
      from db_short_links s
      join db_tenants t on t.id = s.tenant_id
      left join db_param_nodes p on p.id = s.button_id
      where s.slug = ${slug}
      order by s.created_at desc
      limit 1
    `;
  }
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    ...mapShortRow(r),
    brand_company: String(r.brand_company ?? ""),
    brand_color: String(r.brand_color ?? "#1a5f4a"),
    public_host: String(r.custom_domain || r.domain || ""),
  };
}

export async function findTenantBrandByHost(
  host?: string,
): Promise<{ company: string; name: string } | null> {
  const h = (host || "").toLowerCase().replace(/:\d+$/, "");
  if (!h) return null;
  const sql = await getSql();
  const rows = await sql`
    select t.name, t.brand_company
    from db_tenants t
    where lower(t.custom_domain) = ${h}
       or lower(t.domain) = ${h}
       or lower(t.subdomain || '.bestl.ink') = ${h}
       or exists (
         select 1 from db_tenant_domains d
         where d.tenant_id = t.id and lower(d.host) = ${h}
       )
    limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as { name?: string; brand_company?: string };
  return {
    name: String(r.name ?? ""),
    company: String(r.brand_company || r.name || ""),
  };
}

export async function recordShortVisit(input: {
  short: ShortLink;
  ua: string;
  ipHint?: string;
  referrer?: string;
  country?: string;
}): Promise<void> {
  const sql = await getSql();
  const bot = isBotUa(input.ua);
  const parsed = parseUa(input.ua);
  const ipHash = await hashSecret(input.ipHint || input.ua || "unknown");
  await sql`
    insert into db_short_visits (
      id, short_id, tenant_id, is_bot, device, os, browser, country,
      referrer, ip_hash, user_agent
    ) values (
      ${uid("sv")}, ${input.short.id}, ${input.short.tenant_id}, ${bot},
      ${parsed.device}, ${parsed.os}, ${parsed.browser}, ${input.country || ""},
      ${(input.referrer || "").slice(0, 400)}, ${ipHash}, ${input.ua.slice(0, 400)}
    )
  `;
  await sql`
    update db_short_links set
      click_count = click_count + 1,
      human_click_count = human_click_count + ${bot ? 0 : 1},
      last_clicked_at = now()
    where id = ${input.short.id}
  `;
  try {
    await writeActivity({
      tenant_id: input.short.tenant_id,
      short_id: input.short.id,
      event: "click",
      ua: input.ua,
    });
  } catch {
    /* activity table may lag a deploy */
  }
}

export async function createApiKey(
  tenantId: string,
  name: string,
): Promise<{ row: ApiKeyRow; token: string }> {
  const sql = await getSql();
  const raw = `ltis_${genToken(8)}_${genToken(16)}`;
  const prefix = raw.slice(0, 12);
  const id = uid("apk");
  await sql`
    insert into db_api_keys (id, tenant_id, name, prefix, key_hash)
    values (${id}, ${tenantId}, ${name.trim() || "API"}, ${prefix}, ${await hashSecret(raw)})
  `;
  return {
    token: raw,
    row: {
      id,
      tenant_id: tenantId,
      name: name.trim() || "API",
      prefix,
      created_at: new Date().toISOString(),
    },
  };
}

export async function findTenantByApiKey(token: string): Promise<string | null> {
  if (!token) return null;
  const sql = await getSql();
  const hash = await hashSecret(token);
  const row = (
    await sql`select tenant_id from db_api_keys where key_hash = ${hash} limit 1`
  )[0] as { tenant_id?: string } | undefined;
  return row?.tenant_id ? String(row.tenant_id) : null;
}

export { verifySecret };

function assertHttpUrl(url: string): string {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) throw new Error("Ziel-URL muss mit http(s) beginnen");
  try {
    new URL(u);
  } catch {
    throw new Error("Ungültige URL");
  }
  return u;
}

export async function createShortForTenant(
  tenantId: string,
  data: {
    destination: string;
    slug?: string;
    title?: string;
    note?: string;
    tags?: string[];
  },
): Promise<ShortLink> {
  const dest = assertHttpUrl(data.destination);
  let slug = data.slug ? normalizeSlug(data.slug) : await uniqueSlug(tenantId);
  if (await slugTaken(tenantId, slug)) throw new Error("Slug bereits vergeben");
  const sql = await getSql();
  const id = uid("sh");
  await sql`
    insert into db_short_links (
      id, tenant_id, slug, destination, title, note, tags
    ) values (
      ${id}, ${tenantId}, ${slug}, ${dest}, ${data.title ?? ""}, ${data.note ?? ""},
      ${JSON.stringify(data.tags ?? [])}
    )
  `;
  const row = (
    await sql`select * from db_short_links where id = ${id}`
  )[0] as Record<string, unknown>;
  return mapShortRow(row);
}

/** True only when the destination explicitly allows being framed. */
export async function destinationAllowsIframe(url: string): Promise<boolean> {
  try {
    const ctrl = AbortSignal.timeout(1600);
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl,
      headers: { "User-Agent": "bestl.ink/1.0" },
    });
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(1600),
        headers: { "User-Agent": "bestl.ink/1.0", Range: "bytes=0-64" },
      });
    }
    const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
    if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
    const csp = (res.headers.get("content-security-policy") || "").toLowerCase();
    const m = csp.match(/frame-ancestors\s+([^;]+)/);
    if (m) {
      const v = m[1].trim();
      if (!v || v === "'none'" || v === "none") return false;
      if (v.includes("*")) return true;
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

