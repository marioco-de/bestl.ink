import { qrToSvg, withQrFlag } from "@/lib/qr";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getMembership } from "./load-state.server";
import { uid, genToken } from "./id";
import {
  normalizeSlug,
  slugTaken,
  uniqueSlug,
  recordShortVisit,
  pickDestination,
  isOgBot,
  countryFromHeaders,
  createApiKey,
  verifySecret,
  findTenantBrandByHost,
  mapShortRow,
  RESERVED_SLUGS,
} from "./shorts.server";
import { requestHostHeader } from "./request-host.server";
import type { ShortLink } from "./types";
import { defaultFeatures } from "./features";
import type { CsvShortRow } from "@/lib/csv";

async function featureOn(
  tenantId: string,
  key: "short_links" | "public_api",
): Promise<boolean> {
  const sql = await getSql();
  const row = (
    await sql`
      select enabled from db_features
      where tenant_id = ${tenantId} and feature_key = ${key}
      limit 1
    `
  )[0] as { enabled?: boolean } | undefined;
  if (row) return Boolean(row.enabled);
  return defaultFeatures()[key];
}

type ShortInput = {
  destination: string;
  slug?: string;
  title?: string;
  note?: string;
  tags?: string[];
  password?: string;
  expires_hours?: number | null;
  expires_at?: string | null;
  max_clicks?: number | null;
  cloak?: boolean;
  ios_url?: string;
  android_url?: string;
  geo_rules?: Record<string, string>;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  button_id?: string | null;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_extra?: Record<string, string>;
  disabled?: boolean;
  tenant_id?: string;
};

function resolveExpires(
  data: { expires_at?: string | null; expires_hours?: number | null },
  fallback?: string | null,
): string | null {
  if (data.expires_at === null || data.expires_hours === null) return null;
  if (data.expires_at) {
    const d = new Date(data.expires_at);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (data.expires_hours && data.expires_hours > 0) {
    return new Date(Date.now() + data.expires_hours * 3600_000).toISOString();
  }
  return fallback ?? null;
}

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

export const createShort = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: ShortInput) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    if (!(await featureOn(mem.tenant.id, "short_links"))) {
      throw new Error("Kurzlinks deaktiviert");
    }
    const dest = assertHttpUrl(data.destination);
    let slug = data.slug ? normalizeSlug(data.slug) : await uniqueSlug(mem.tenant.id);
    if (!slug) slug = await uniqueSlug(mem.tenant.id);
    if (await slugTaken(mem.tenant.id, slug)) throw new Error("Slug bereits vergeben");
    const sql = await getSql();
    const id = uid("sh");
    const pw = data.password ? await (await import("./id")).hashSecret(data.password) : null;
    const expires = resolveExpires(data);
    await sql`
      insert into db_short_links (
        id, tenant_id, slug, destination, title, note, tags, password_hash,
        expires_at, max_clicks, cloak, ios_url, android_url, geo_rules,
        og_title, og_description, og_image, button_id,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_extra, created_by
      ) values (
        ${id}, ${mem.tenant.id}, ${slug}, ${dest}, ${data.title ?? ""}, ${data.note ?? ""},
        ${JSON.stringify(data.tags ?? [])}, ${pw}, ${expires}, ${data.max_clicks ?? null},
        ${Boolean(data.cloak)}, ${data.ios_url || null}, ${data.android_url || null},
        ${JSON.stringify(data.geo_rules ?? {})}, ${data.og_title || null},
        ${data.og_description || null}, ${data.og_image || null}, ${data.button_id || null},
        ${data.utm_source || null}, ${data.utm_medium || null}, ${data.utm_campaign || null},
        ${data.utm_term || null}, ${data.utm_content || null},
        ${JSON.stringify(data.utm_extra ?? {})},
        ${context.userId}
      )
    `;
    void import("./short-cache.server").then((m) => m.bustShort(slug));
    const row = (
      await sql`select s.*, p.name as button_name from db_short_links s
        left join db_param_nodes p on p.id = s.button_id
        where s.id = ${id}`
    )[0] as Record<string, unknown>;
    return { short: mapShortRow(row) };
  });

export const updateShort = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: ShortInput & { id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    const dest = assertHttpUrl(data.destination);
    const slug = data.slug ? normalizeSlug(data.slug) : "";
    if (slug && (await slugTaken(mem.tenant.id, slug, data.id))) {
      throw new Error("Slug bereits vergeben");
    }
    const sql = await getSql();
    const cur = (
      await sql`select * from db_short_links where id = ${data.id} and tenant_id = ${mem.tenant.id}`
    )[0] as Record<string, unknown> | undefined;
    if (!cur) throw new Error("Nicht gefunden");
    const pw = data.password
      ? await (await import("./id")).hashSecret(data.password)
      : cur.password_hash;
    const expires = resolveExpires(data, cur.expires_at as string | null);
    await sql`
      update db_short_links set
        slug = ${slug || String(cur.slug)},
        destination = ${dest},
        title = ${data.title ?? String(cur.title)},
        note = ${data.note ?? String(cur.note)},
        tags = ${JSON.stringify(data.tags ?? [])},
        password_hash = ${pw as string | null},
        expires_at = ${expires as string | null},
        max_clicks = ${data.max_clicks ?? null},
        disabled = ${Boolean(data.disabled)},
        cloak = ${Boolean(data.cloak)},
        ios_url = ${data.ios_url || null},
        android_url = ${data.android_url || null},
        geo_rules = ${JSON.stringify(data.geo_rules ?? {})},
        og_title = ${data.og_title || null},
        og_description = ${data.og_description || null},
        og_image = ${data.og_image || null},
        button_id = ${data.button_id || null},
        utm_source = ${data.utm_source || null},
        utm_medium = ${data.utm_medium || null},
        utm_campaign = ${data.utm_campaign || null},
        utm_term = ${data.utm_term || null},
        utm_content = ${data.utm_content || null},
        utm_extra = ${JSON.stringify(data.utm_extra ?? {})}
      where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;
    const nextSlug = slug || String(cur.slug);
    void import("./short-cache.server").then((m) => {
      void m.bustShort(nextSlug);
      if (String(cur.slug) !== nextSlug) void m.bustShort(String(cur.slug));
    });
    const row = (
      await sql`select s.*, p.name as button_name from db_short_links s
        left join db_param_nodes p on p.id = s.button_id
        where s.id = ${data.id}`
    )[0] as Record<string, unknown>;
    return { short: mapShortRow(row) };
  });

export const deleteShort = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    const prev = (
      await sql`select slug from db_short_links where id = ${data.id} and tenant_id = ${mem.tenant.id} limit 1`
    )[0] as { slug?: string } | undefined;
    await sql`delete from db_short_links where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    if (prev?.slug) void import("./short-cache.server").then((m) => m.bustShort(String(prev.slug)));
    return { id: data.id };
  });

export const toggleShort = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; disabled: boolean; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`
      update db_short_links set disabled = ${data.disabled}
      where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;
    const row = (
      await sql`select s.*, p.name as button_name from db_short_links s
        left join db_param_nodes p on p.id = s.button_id
        where s.id = ${data.id}`
    )[0] as Record<string, unknown>;
    const mapped = mapShortRow(row);
    void import("./short-cache.server").then((m) => m.bustShort(mapped.slug));
    return { short: mapped };
  });

export const getShortAnalytics = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string; range?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const { loadShortAnalytics } = await import("./shorts.server");
    return loadShortAnalytics(mem.tenant.id, data.id, data.range);
  });

export const qrForUrl = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    return { svg: qrToSvg(withQrFlag(data.url)) };
  });

export const fetchLinkPreview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { url: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const { fetchOgFromUrl, ogPublicPath } = await import("./og-preview.server");
    const og = await fetchOgFromUrl(data.url);
    return {
      title: og.title,
      description: og.description,
      source: og.source,
      image: og.imageId ? ogPublicPath(og.imageId) : null,
      imageId: og.imageId,
    };
  });

export const saveOgImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { data: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const raw = data.data.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(raw, "base64");
    if (buf.length < 32 || buf.length > 900_000) throw new Error("Bild ungültig oder zu groß");
    const { saveOgBlob } = await import("./storage.server");
    const { ogPublicPath } = await import("./og-preview.server");
    const id = await saveOgBlob(buf, "image/webp");
    return { id, url: ogPublicPath(id) };
  });

const IMPORT_MAX = 500;

export const importShorts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; rows: CsvShortRow[] }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    if (!(await featureOn(mem.tenant.id, "short_links"))) {
      throw new Error("Kurzlinks deaktiviert");
    }
    const rows = data.rows.slice(0, IMPORT_MAX);
    const sql = await getSql();
    const created: ShortLink[] = [];
    const errors: { row: number; message: string }[] = [];
    const used = new Set<string>();
    const existing = await sql`
      select slug from db_short_links where tenant_id = ${mem.tenant.id}
    `;
    for (const r of existing as { slug?: string }[]) used.add(String(r.slug));
    const resSlugs = await sql`
      select slug from db_resources where tenant_id = ${mem.tenant.id}
    `;
    for (const r of resSlugs as { slug?: string }[]) used.add(String(r.slug));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      try {
        const dest = assertHttpUrl(row.destination);
        let slug = row.slug ? normalizeSlug(row.slug) : "";
        if (slug) {
          if (used.has(slug) || RESERVED_SLUGS.has(slug)) {
            throw new Error(`Slug „${slug}“ ist vergeben`);
          }
        } else {
          for (let n = 0; n < 12; n++) {
            const s = genToken(5);
            if (!used.has(s) && !RESERVED_SLUGS.has(s)) {
              slug = s;
              break;
            }
          }
          if (!slug) slug = genToken(8);
        }
        used.add(slug);
        const id = uid("sh");
        const expires = resolveExpires({ expires_at: row.expires_at || null });
        await sql`
          insert into db_short_links (
            id, tenant_id, slug, destination, title, note, tags,
            expires_at, cloak, ios_url, android_url,
            utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_by
          ) values (
            ${id}, ${mem.tenant.id}, ${slug}, ${dest}, ${row.title ?? ""}, ${row.note ?? ""},
            ${JSON.stringify(row.tags ?? [])}, ${expires}, ${Boolean(row.cloak)},
            ${row.ios_url || null}, ${row.android_url || null},
            ${row.utm_source || null}, ${row.utm_medium || null}, ${row.utm_campaign || null},
            ${row.utm_term || null}, ${row.utm_content || null}, ${context.userId}
          )
        `;
        created.push(
          mapShortRow({
            id,
            tenant_id: mem.tenant.id,
            slug,
            destination: dest,
            title: row.title ?? "",
            note: row.note ?? "",
            tags: row.tags ?? [],
            cloak: Boolean(row.cloak),
            ios_url: row.ios_url || null,
            android_url: row.android_url || null,
            utm_source: row.utm_source || null,
            utm_medium: row.utm_medium || null,
            utm_campaign: row.utm_campaign || null,
            utm_term: row.utm_term || null,
            utm_content: row.utm_content || null,
            click_count: 0,
            human_click_count: 0,
            created_at: new Date().toISOString(),
          }),
        );
      } catch (e) {
        errors.push({
          row: i + 2,
          message: e instanceof Error ? e.message : "Ungültige Zeile",
        });
      }
    }
    return { created, errors, truncated: data.rows.length > IMPORT_MAX };
  });

export const createWorkspaceApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { name?: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    if (!(await featureOn(mem.tenant.id, "public_api"))) throw new Error("API deaktiviert");
    const created = await createApiKey(mem.tenant.id, data.name || "API-Key");
    return { token: created.token, row: created.row };
  });

export const deleteWorkspaceApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`delete from db_api_keys where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return { id: data.id };
  });

export const resolveShort = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: string;
      password?: string;
      user_agent?: string;
      host?: string;
      referrer?: string;
      ip_hint?: string;
      country?: string;
      lang?: string;
      qr?: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const slug = normalizeSlug(data.slug);
    const { getShortBundle, afterResponse } = await import("./short-cache.server");
    const found = await getShortBundle(slug, data.host);
    if (!found) throw new Error("NOT_FOUND");
    const short: ShortLink = found.short;
    if (short.disabled) throw new Error("DISABLED");
    if (short.expires_at && new Date(short.expires_at).getTime() < Date.now()) {
      throw new Error("EXPIRED");
    }
    if (short.max_clicks != null && short.click_count >= short.max_clicks) {
      throw new Error("LIMIT");
    }
    if (short.has_password) {
      const ok = await verifySecret(data.password || "", found.password_hash);
      if (!ok) {
        return {
          kind: "short" as const,
          access: "password" as const,
          short,
          company: found.brand_company,
          brand_color: found.brand_color,
        };
      }
    }
    const ua = data.user_agent || "";
    const country = countryFromHeaders({
      cf: data.country,
      vercel: null,
      lang: data.lang,
    });
    const dest = pickDestination(short, ua, country);
    afterResponse(
      recordShortVisit({
        short,
        ua,
        ipHint: data.ip_hint,
        referrer: data.referrer,
        country,
        trigger: data.qr ? "qr" : "link",
      }),
    );
    const splash = found.splash;
    const branded = splash.mode !== "off";
    return {
      kind: "short" as const,
      access: "granted" as const,
      short,
      destination: dest,
      cloak: short.cloak,
      og: isOgBot(ua),
      branded,
      frameable: false,
      splash,
      company: found.brand_company,
      brand_color: found.brand_color,
    };
  });

export const lookupMiss = createServerFn({ method: "POST" })
  .inputValidator((d: { host?: string } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const host = (data.host || requestHostHeader()).toLowerCase().replace(/:\d+$/, "");
    const brand = await findTenantBrandByHost(host);
    return { host, company: brand?.company || "" };
  });

