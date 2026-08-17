import { qrToSvg } from "@/lib/qr";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getMembership, loadFullState } from "./load-state.server";
import { uid } from "./id";
import {
  normalizeSlug,
  slugTaken,
  uniqueSlug,
  findShortBySlug,
  recordShortVisit,
  pickDestination,
  isOgBot,
  countryFromHeaders,
  createApiKey,
  verifySecret,
} from "./shorts.server";
import type { ShortLink } from "./types";

type ShortInput = {
  destination: string;
  slug?: string;
  title?: string;
  note?: string;
  tags?: string[];
  password?: string;
  expires_hours?: number | null;
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
  disabled?: boolean;
  tenant_id?: string;
};

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
    const state = await loadFullState(context.userId, mem.tenant.id);
    if (!state?.features.short_links) throw new Error("Kurzlinks deaktiviert");
    const dest = assertHttpUrl(data.destination);
    let slug = data.slug ? normalizeSlug(data.slug) : await uniqueSlug(mem.tenant.id);
    if (!slug) slug = await uniqueSlug(mem.tenant.id);
    if (await slugTaken(mem.tenant.id, slug)) throw new Error("Slug bereits vergeben");
    const sql = await getSql();
    const id = uid("sh");
    const pw = data.password ? await (await import("./id")).hashSecret(data.password) : null;
    const expires =
      data.expires_hours && data.expires_hours > 0
        ? new Date(Date.now() + data.expires_hours * 3600_000).toISOString()
        : null;
    await sql`
      insert into db_short_links (
        id, tenant_id, slug, destination, title, note, tags, password_hash,
        expires_at, max_clicks, cloak, ios_url, android_url, geo_rules,
        og_title, og_description, og_image, button_id,
        utm_source, utm_medium, utm_campaign, created_by
      ) values (
        ${id}, ${mem.tenant.id}, ${slug}, ${dest}, ${data.title ?? ""}, ${data.note ?? ""},
        ${JSON.stringify(data.tags ?? [])}, ${pw}, ${expires}, ${data.max_clicks ?? null},
        ${Boolean(data.cloak)}, ${data.ios_url || null}, ${data.android_url || null},
        ${JSON.stringify(data.geo_rules ?? {})}, ${data.og_title || null},
        ${data.og_description || null}, ${data.og_image || null}, ${data.button_id || null},
        ${data.utm_source || null}, ${data.utm_medium || null}, ${data.utm_campaign || null},
        ${context.userId}
      )
    `;
    return loadFullState(context.userId, mem.tenant.id);
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
    const expires =
      data.expires_hours === null
        ? null
        : data.expires_hours && data.expires_hours > 0
          ? new Date(Date.now() + data.expires_hours * 3600_000).toISOString()
          : cur.expires_at;
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
        utm_campaign = ${data.utm_campaign || null}
      where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const deleteShort = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`delete from db_short_links where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return loadFullState(context.userId, mem.tenant.id);
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
    return loadFullState(context.userId, mem.tenant.id);
  });

export const getShortAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    const visits = await sql`
      select is_bot, device, os, browser, country, referrer, created_at
      from db_short_visits
      where short_id = ${data.id} and tenant_id = ${mem.tenant.id}
      order by created_at desc
      limit 500
    `;
    const rows = visits.map((v) => {
      const r = v as Record<string, unknown>;
      return {
        is_bot: Boolean(r.is_bot),
        device: String(r.device ?? ""),
        os: String(r.os ?? ""),
        browser: String(r.browser ?? ""),
        country: String(r.country ?? ""),
        referrer: String(r.referrer ?? ""),
        created_at: new Date(r.created_at as string).toISOString(),
      };
    });
    const countBy = (key: keyof (typeof rows)[0]) => {
      const m: Record<string, number> = {};
      for (const r of rows) {
        if (r.is_bot) continue;
        const k = String(r[key] || "—");
        m[k] = (m[k] ?? 0) + 1;
      }
      return Object.entries(m)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };
    const byDay: Record<string, number> = {};
    for (const r of rows) {
      if (r.is_bot) continue;
      const d = r.created_at.slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    return {
      total: rows.length,
      human: rows.filter((r) => !r.is_bot).length,
      devices: countBy("device"),
      os: countBy("os"),
      browsers: countBy("browser"),
      countries: countBy("country"),
      referrers: countBy("referrer"),
      days: Object.entries(byDay)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      recent: rows.slice(0, 30),
    };
  });

export const qrForUrl = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    return { svg: qrToSvg(data.url) };
  });

export const createWorkspaceApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { name?: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const state = await loadFullState(context.userId, mem.tenant.id);
    if (!state?.features.public_api) throw new Error("API deaktiviert");
    const created = await createApiKey(mem.tenant.id, data.name || "API-Key");
    return { token: created.token, state: await loadFullState(context.userId, mem.tenant.id) };
  });

export const deleteWorkspaceApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`delete from db_api_keys where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return loadFullState(context.userId, mem.tenant.id);
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
    }) => d,
  )
  .handler(async ({ data }) => {
    const slug = normalizeSlug(data.slug);
    const found = await findShortBySlug(slug, data.host);
    if (!found) throw new Error("NOT_FOUND");
    const short: ShortLink = found;
    if (short.disabled) throw new Error("DISABLED");
    if (short.expires_at && new Date(short.expires_at).getTime() < Date.now()) {
      throw new Error("EXPIRED");
    }
    if (short.max_clicks != null && short.click_count >= short.max_clicks) {
      throw new Error("LIMIT");
    }
    if (short.has_password) {
      const row = (
        await (await getSql())`
          select password_hash from db_short_links where id = ${short.id}
        `
      )[0] as { password_hash?: string } | undefined;
      const ok = await verifySecret(data.password || "", row?.password_hash);
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
    await recordShortVisit({
      short,
      ua,
      ipHint: data.ip_hint,
      referrer: data.referrer,
      country,
    });
    return {
      kind: "short" as const,
      access: "granted" as const,
      short,
      destination: dest,
      cloak: short.cloak,
      og: isOgBot(ua),
      company: found.brand_company,
      brand_color: found.brand_color,
    };
  });

