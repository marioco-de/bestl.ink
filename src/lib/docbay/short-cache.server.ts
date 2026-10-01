import { getSql } from "@/lib/db";
import { cacheDel, cacheGet, cacheIncr, cacheSet, afterResponse } from "@/lib/cache.server";
import { defaultFeatures, featuresFromRows } from "./features";
import { parseSplash, publicSplash } from "./splash";
import { mapShortRow } from "./shorts.server";
import type { ShortLink } from "./types";

const LOOKUP_TTL = 90;
const FEAT_TTL = 120;

export type ShortBundle = {
  short: ShortLink;
  brand_company: string;
  brand_color: string;
  splash: ReturnType<typeof publicSplash>;
  password_hash: string | null;
};

type Wrapped = { v: number; data: ShortBundle };

function lookupKey(host: string, slug: string): string {
  return `sl:${host}|${slug}`;
}

function verKey(slug: string): string {
  return `sv:${slug}`;
}

function featKey(tenantId: string): string {
  return `sf:${tenantId}`;
}

async function loadFeatures(tenantId: string) {
  const hit = await cacheGet<Record<string, boolean>>(featKey(tenantId));
  if (hit) return { ...defaultFeatures(), ...hit };
  const sql = await getSql();
  const rows = (await sql`
    select feature_key, enabled from db_features
    where tenant_id = ${tenantId}
      and feature_key in ('unbranded_redirect','brand_custom','splash_logo','hide_brand_flag')
  `) as { feature_key: string; enabled: boolean }[];
  const features = featuresFromRows(rows, defaultFeatures());
  await cacheSet(
    featKey(tenantId),
    {
      unbranded_redirect: features.unbranded_redirect,
      brand_custom: features.brand_custom,
      splash_logo: features.splash_logo,
      hide_brand_flag: features.hide_brand_flag,
    },
    FEAT_TTL,
  );
  return features;
}

async function loadBundle(slug: string, host: string): Promise<ShortBundle | null> {
  const sql = await getSql();
  const h = host.toLowerCase().replace(/:\d+$/, "");
  let rows: unknown[] = [];
  if (h) {
    rows = await sql`
      select s.*, p.name as button_name, t.brand_company, t.brand_color, t.splash, t.brand_logo_url,
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
      select s.*, p.name as button_name, t.brand_company, t.brand_color, t.splash, t.brand_logo_url,
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
  const short = mapShortRow(r);
  const features = await loadFeatures(short.tenant_id);
  return {
    short,
    brand_company: String(r.brand_company ?? ""),
    brand_color: String(r.brand_color ?? "#1a5f4a"),
    splash: publicSplash(
      parseSplash(r.splash),
      features,
      r.brand_logo_url ? String(r.brand_logo_url) : null,
    ),
    password_hash: r.password_hash ? String(r.password_hash) : null,
  };
}

export async function getShortBundle(slug: string, host?: string): Promise<ShortBundle | null> {
  const h = (host || "").toLowerCase().replace(/:\d+$/, "");
  const key = lookupKey(h, slug);
  const v = (await cacheGet<number>(verKey(slug))) || 0;
  const hit = await cacheGet<Wrapped>(key);
  if (hit && hit.v === v && hit.data?.short) return hit.data;
  const data = await loadBundle(slug, h);
  if (!data) return null;
  await cacheSet(key, { v, data }, LOOKUP_TTL);
  return data;
}

export async function bustShort(slug: string): Promise<void> {
  await cacheIncr(verKey(slug));
  await cacheDel(lookupKey("", slug));
}

export async function bustTenantFeatures(tenantId: string): Promise<void> {
  await cacheDel(featKey(tenantId));
}

export async function bustTenantShorts(tenantId: string): Promise<void> {
  await bustTenantFeatures(tenantId);
  const sql = await getSql();
  const rows = (await sql`select slug from db_short_links where tenant_id = ${tenantId}`) as {
    slug?: string;
  }[];
  for (const r of rows) {
    const slug = String(r.slug || "");
    if (slug) await bustShort(slug);
  }
}

export { afterResponse };
