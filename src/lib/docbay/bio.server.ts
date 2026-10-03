import { getSql } from "@/lib/db";
import { parseBio, parseStore, bioSlugOk, type BioPage, type BioStore } from "./bio";

function hostOf(host?: string): string {
  return (host || "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

export async function loadBioStore(tenantId: string): Promise<BioStore> {
  const sql = await getSql();
  const row = (
    await sql`select bio from db_tenants where id = ${tenantId} limit 1`
  )[0] as { bio?: unknown } | undefined;
  if (!row) return { active: "main", cards: [parseBio(null)] };
  return parseStore(row.bio);
}

export async function loadTenantBio(tenantId: string): Promise<BioPage | null> {
  const sql = await getSql();
  const row = (
    await sql`select id from db_tenants where id = ${tenantId} limit 1`
  )[0];
  if (!row) return null;
  const store = await loadBioStore(tenantId);
  return store.cards.find((c) => c.id === store.active) || store.cards[0] || null;
}

export async function writeBioStore(tenantId: string, store: BioStore): Promise<void> {
  const sql = await getSql();
  const active = store.cards.find((c) => c.id === store.active) || store.cards[0];
  if (!active) return;
  const payload = { ...active, active: store.active, cards: store.cards };
  await sql`update db_tenants set bio = ${JSON.stringify(payload)}::jsonb where id = ${tenantId}`;
}

export async function writeTenantBio(tenantId: string, page: BioPage): Promise<void> {
  const store = await loadBioStore(tenantId);
  const cards = store.cards.some((c) => c.id === page.id)
    ? store.cards.map((c) => (c.id === page.id ? page : c))
    : [page, ...store.cards].slice(0, 12);
  await writeBioStore(tenantId, { active: page.id, cards });
}

export async function slugTaken(tenantId: string, slug: string): Promise<boolean> {
  const sql = await getSql();
  const short = (
    await sql`
      select id from db_short_links
      where tenant_id = ${tenantId} and lower(slug) = ${slug}
      limit 1
    `
  )[0];
  return Boolean(short);
}

export function assertBio(page: BioPage): void {
  if (page.published && !bioSlugOk(page.slug)) {
    throw new Error("SLUG");
  }
  if (page.slug && !bioSlugOk(page.slug)) throw new Error("SLUG");
}

type Found = { id: string; page: BioPage; company: string };

async function rowsFor(slug: string, host: string): Promise<Found[]> {
  const sql = await getSql();
  const h = host;
  const rows = h
    ? await sql`
        select t.id, t.bio, t.brand_company, t.name
        from db_tenants t
        where (
            (
              lower(coalesce(t.bio->>'slug', '')) = ${slug}
              and coalesce(t.bio->>'published', '') = 'true'
            )
            or exists (
              select 1 from jsonb_array_elements(
                case when jsonb_typeof(t.bio->'cards') = 'array' then t.bio->'cards' else '[]'::jsonb end
              ) c
              where lower(coalesce(c->>'slug', '')) = ${slug}
                and coalesce(c->>'published', '') = 'true'
            )
          )
          and (
            lower(coalesce(t.custom_domain, '')) = ${h}
            or lower(coalesce(t.domain, '')) = ${h}
            or lower(t.subdomain || '.bestl.ink') = ${h}
            or exists (
              select 1 from db_tenant_domains d
              where d.tenant_id = t.id and lower(d.host) = ${h}
            )
          )
        limit 2
      `
    : await sql`
        select t.id, t.bio, t.brand_company, t.name
        from db_tenants t
        where (
            lower(coalesce(t.bio->>'slug', '')) = ${slug}
            and coalesce(t.bio->>'published', '') = 'true'
          )
          or exists (
            select 1 from jsonb_array_elements(
              case when jsonb_typeof(t.bio->'cards') = 'array' then t.bio->'cards' else '[]'::jsonb end
            ) c
            where lower(coalesce(c->>'slug', '')) = ${slug}
              and coalesce(c->>'published', '') = 'true'
          )
        limit 2
      `;
  return (rows as Record<string, unknown>[]).map((r) => {
    const store = parseStore(r.bio);
    const page =
      store.cards.find((c) => c.slug === slug && c.published) || parseBio(r.bio);
    return {
      id: String(r.id),
      page,
      company: String(r.brand_company || r.name || ""),
    };
  });
}

export async function findPublishedBio(
  slug: string,
  host?: string,
): Promise<Found | null> {
  const clean = slug.trim().toLowerCase();
  if (!bioSlugOk(clean) || clean.includes("/")) return null;
  const h = hostOf(host);
  const matched = await rowsFor(clean, h);
  if (matched.length === 1) return matched[0];
  if (matched.length > 1) return null;
  if (!h) return null;
  const any = await rowsFor(clean, "");
  return any.length === 1 ? any[0] : null;
}
