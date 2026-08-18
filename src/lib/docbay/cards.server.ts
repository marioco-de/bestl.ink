import { getSql } from "@/lib/db";
import { parseJsonObj, uid, hashSecret, isBotUa } from "./id";
import {
  buildIcs,
  buildVcf,
  parseContactPayload,
  parseEventPayload,
} from "./cards";
import { parseRequireRequest } from "./doc-actions";
import { requestHostHeader } from "./request-host.server";
import { PLATFORM_LINK_HOST } from "./load-state.server";

export async function handleCardRequest(
  request: Request,
  slugOrId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const token = (url.searchParams.get("access") || "").trim();
  const host = (url.host || requestHostHeader()).toLowerCase().replace(/:\d+$/, "");
  const sub = host.endsWith(`.${PLATFORM_LINK_HOST}`)
    ? host.slice(0, -(PLATFORM_LINK_HOST.length + 1))
    : null;
  const key = slugOrId.replace(/^\//, "").replace(/\/$/, "");
  const keyBare = key.replace(/\.(ics|vcf)$/i, "");
  const sql = await getSql();

  const resRows = await sql`
    select r.*, t.custom_domain, t.domain, t.subdomain
    from db_resources r
    join db_tenants t on t.id = r.tenant_id
    where r.type in ('event', 'contact')
      and (
        r.id = ${key}
        or lower(r.slug) = ${key.toLowerCase()}
        or lower(r.slug) = ${keyBare.toLowerCase()}
        or lower(r.slug) = ${`${keyBare}.ics`}
        or lower(r.slug) = ${`${keyBare}.vcf`}
      )
      and (
        ${host} = ''
        or lower(coalesce(t.custom_domain, '')) = ${host}
        or lower(coalesce(t.domain, '')) = ${host}
        or (${sub} is not null and t.subdomain = ${sub})
        or exists (
          select 1 from db_tenant_domains d
          where d.tenant_id = t.id and lower(d.host) = ${host}
        )
      )
    order by t.created_at desc
    limit 1
  `;
  const resource = (resRows[0] as Record<string, unknown> | undefined) ?? (
    await sql`
      select r.*, t.custom_domain, t.domain, t.subdomain
      from db_resources r
      join db_tenants t on t.id = r.tenant_id
      where r.type in ('event', 'contact')
        and (
          r.id = ${key}
          or lower(r.slug) = ${key.toLowerCase()}
          or lower(r.slug) = ${keyBare.toLowerCase()}
          or lower(r.slug) = ${`${keyBare}.ics`}
          or lower(r.slug) = ${`${keyBare}.vcf`}
        )
      order by t.created_at desc
      limit 1
    `
  )[0] as Record<string, unknown> | undefined;
  if (!resource) return new Response("Nicht gefunden", { status: 404 });

  const needsRequest = parseRequireRequest(
    parseJsonObj(resource.payload),
    String(resource.type),
  );

  let link: Record<string, unknown> | null = null;
  if (token) {
    const linkRows = await sql`
      select * from db_links
      where resource_id = ${String(resource.id)} and token = ${token}
      limit 1
    `;
    link = (linkRows[0] as Record<string, unknown> | undefined) ?? null;
    if (!link && needsRequest) return new Response("Zugriff fehlt", { status: 401 });
    if (link?.revoked) return new Response("Widerrufen", { status: 403 });
    if (link?.expires_at && new Date(String(link.expires_at)).getTime() < Date.now()) {
      return new Response("Abgelaufen", { status: 403 });
    }
    if (link?.one_time && link.used_at) return new Response("Bereits verwendet", { status: 403 });
  } else if (needsRequest) {
    return new Response("Zugriff fehlt", { status: 401 });
  }

  const type = String(resource.type);
  const payload = parseJsonObj(resource.payload);
  const slug = String(resource.slug || "download");
  const ua = request.headers.get("user-agent") || "";
  const bot = isBotUa(ua);

  if (link) {
    const ipHash = await hashSecret(
      request.headers.get("x-forwarded-for") || ua || "unknown",
    );
    await sql`
      insert into db_clicks (id, link_id, tenant_id, is_bot, user_agent, ip_hash)
      values (${uid("click")}, ${String(link.id)}, ${String(resource.tenant_id)}, ${bot}, ${ua}, ${ipHash})
    `;
    await sql`
      update db_links set
        click_count = click_count + 1,
        human_click_count = human_click_count + ${bot ? 0 : 1},
        last_clicked_at = now(),
        used_at = case when one_time and used_at is null then now() else used_at end
      where id = ${String(link.id)}
    `;
  }

  if (type === "event") {
    const body = buildIcs(parseEventPayload(payload), String(resource.id));
    const name = slug.endsWith(".ics") ? slug : `${slug}.ics`;
    return fileResponse(body, "text/calendar; charset=utf-8", name);
  }
  if (type === "contact") {
    const body = buildVcf(parseContactPayload(payload), String(resource.id));
    const name = slug.endsWith(".vcf") ? slug : `${slug}.vcf`;
    return fileResponse(body, "text/vcard; charset=utf-8", name);
  }
  return new Response("Kein Kalender/Kontakt", { status: 400 });
}

function fileResponse(body: string, type: string, name: string): Response {
  const safe = name.replace(/["\r\n]/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  });
}