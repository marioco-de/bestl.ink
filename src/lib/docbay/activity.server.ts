import { getSql } from "@/lib/db";
import { uid } from "./id";
import { requestClientIp, requestCountry } from "./request-host.server";
import type { ActivityEvent, LinkPresence } from "./types";

export async function writeActivity(input: {
  tenant_id: string;
  short_id?: string | null;
  link_id?: string | null;
  event: string;
  email?: string;
  ua?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const sql = await getSql();
  const email = (input.email || "").trim().toLowerCase();
  const country = requestCountry();
  const ip = requestClientIp();
  const ua = (input.ua || "").slice(0, 400);
  const shortId = input.short_id || "";
  const linkId = input.link_id || "";
  if (!shortId && !linkId) return;
  await sql`
    insert into db_activity (
      id, tenant_id, short_id, link_id, event, email, country, ip, user_agent, meta
    ) values (
      ${uid("act")}, ${input.tenant_id}, ${shortId}, ${linkId}, ${input.event},
      ${email}, ${country}, ${ip}, ${ua}, ${JSON.stringify(input.meta ?? {})}
    )
  `;
  if (input.event === "heartbeat") {
    await upsertPresence(sql, {
      tenant_id: input.tenant_id,
      short_id: shortId,
      link_id: linkId,
      email,
      country,
      open: true,
    });
    return;
  }
  await upsertPresence(sql, {
    tenant_id: input.tenant_id,
    short_id: shortId,
    link_id: linkId,
    email,
    country,
    open: input.event !== "close",
  });
}

async function upsertPresence(
  sql: Awaited<ReturnType<typeof getSql>>,
  row: {
    tenant_id: string;
    short_id: string;
    link_id: string;
    email: string;
    country: string;
    open: boolean;
  },
) {
  const existing = (
    await sql`
      select id from db_presence
      where tenant_id = ${row.tenant_id}
        and coalesce(short_id, '') = ${row.short_id || ""}
        and coalesce(link_id, '') = ${row.link_id || ""}
        and email = ${row.email}
      limit 1
    `
  )[0] as { id?: string } | undefined;
  if (existing?.id) {
    await sql`
      update db_presence set
        country = ${row.country},
        open = ${row.open},
        last_seen = now()
      where id = ${existing.id}
    `;
    return;
  }
  await sql`
    insert into db_presence (id, tenant_id, short_id, link_id, email, country, open, last_seen)
    values (
      ${uid("pre")}, ${row.tenant_id}, ${row.short_id}, ${row.link_id},
      ${row.email}, ${row.country}, ${row.open}, now()
    )
  `;
}

export async function loadPresenceMap(tenantId: string): Promise<{
  shorts: Map<string, LinkPresence>;
  links: Map<string, LinkPresence>;
}> {
  const sql = await getSql();
  const shorts = new Map<string, LinkPresence>();
  const links = new Map<string, LinkPresence>();
  try {
    const rows = await sql`
      select short_id, link_id, email, country, open, last_seen
      from db_presence
      where tenant_id = ${tenantId}
        and last_seen > now() - interval '48 hours'
      order by last_seen desc
    `;
    for (const raw of rows) {
      const r = raw as Record<string, unknown>;
      const rec: LinkPresence = {
        event: r.open ? "open" : "close",
        email: String(r.email || ""),
        country: String(r.country || ""),
        at: new Date(r.last_seen as string).toISOString(),
        open: Boolean(r.open),
      };
      const sid = r.short_id ? String(r.short_id) : "";
      const lid = r.link_id ? String(r.link_id) : "";
      if (sid && !shorts.has(sid)) shorts.set(sid, rec);
      if (lid && !links.has(lid)) links.set(lid, rec);
    }
  } catch {
    /* table may not exist yet */
  }
  return { shorts, links };
}

export async function listActivityEvents(input: {
  tenant_id: string;
  short_id?: string;
  link_id?: string;
}): Promise<ActivityEvent[]> {
  const sql = await getSql();
  const rows = input.short_id
    ? await sql`
        select * from db_activity
        where tenant_id = ${input.tenant_id} and short_id = ${input.short_id}
          and event <> 'heartbeat'
        order by created_at desc
        limit 80
      `
    : await sql`
        select * from db_activity
        where tenant_id = ${input.tenant_id} and link_id = ${input.link_id || ""}
          and event <> 'heartbeat'
        order by created_at desc
        limit 80
      `;
  return rows.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      event: String(r.event),
      email: String(r.email || ""),
      country: String(r.country || ""),
      ip: String(r.ip || ""),
      user_agent: String(r.user_agent || ""),
      created_at: new Date(r.created_at as string).toISOString(),
    };
  });
}

export async function listRecentActivity(
  tenantId: string,
  limit = 16,
): Promise<(ActivityEvent & { target: string })[]> {
  const sql = await getSql();
  try {
    const rows = await sql`
      select
        a.id, a.event, a.email, a.country, a.ip, a.user_agent, a.created_at,
        coalesce(s.slug, r.title, '') as target
      from db_activity a
      left join db_short_links s on s.id = nullif(a.short_id, '')
      left join db_links l on l.id = nullif(a.link_id, '')
      left join db_resources r on r.id = l.resource_id
      where a.tenant_id = ${tenantId}
        and a.event <> 'heartbeat'
      order by a.created_at desc
      limit ${limit}
    `;
    return rows.map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        event: String(r.event),
        email: String(r.email || ""),
        country: String(r.country || ""),
        ip: String(r.ip || ""),
        user_agent: String(r.user_agent || ""),
        created_at: new Date(r.created_at as string).toISOString(),
        target: String(r.target || ""),
      };
    });
  } catch {
    return [];
  }
}
