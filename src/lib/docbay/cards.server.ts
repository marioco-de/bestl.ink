import { getSql } from "@/lib/db";
import { parseJsonObj, uid, hashSecret, isBotUa } from "./id";
import {
  buildIcs,
  buildVcf,
  parseContactPayload,
  parseEventPayload,
} from "./cards";

export async function handleCardRequest(
  request: Request,
  resourceId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("access") || "";
  if (!token) {
    return new Response("Zugriff fehlt", { status: 401 });
  }
  const sql = await getSql();
  const rows = await sql`
    select r.*, l.id as link_id, l.revoked, l.expires_at, l.one_time, l.used_at,
           l.created_by, l.note
    from db_resources r
    join db_links l on l.resource_id = r.id
    where (r.id = ${resourceId} or r.slug = ${resourceId}) and l.token = ${token}
    limit 1
  `;
  if (rows.length === 0) {
    return new Response("Nicht gefunden", { status: 404 });
  }
  const row = rows[0] as Record<string, unknown>;
  if (row.revoked) return new Response("Widerrufen", { status: 403 });
  if (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now()) {
    return new Response("Abgelaufen", { status: 403 });
  }
  if (row.one_time && row.used_at) return new Response("Bereits verwendet", { status: 403 });

  const type = String(row.type);
  const payload = parseJsonObj(row.payload);
  const slug = String(row.slug || "download");
  const ua = request.headers.get("user-agent") || "";
  const bot = isBotUa(ua);
  const ipHash = await hashSecret(
    request.headers.get("x-forwarded-for") || ua || "unknown",
  );

  await sql`
    insert into db_clicks (id, link_id, tenant_id, is_bot, user_agent, ip_hash)
    values (${uid("click")}, ${String(row.link_id)}, ${String(row.tenant_id)}, ${bot}, ${ua}, ${ipHash})
  `;
  await sql`
    update db_links set
      click_count = click_count + 1,
      human_click_count = human_click_count + ${bot ? 0 : 1},
      last_clicked_at = now(),
      used_at = case when one_time and used_at is null then now() else used_at end
    where id = ${String(row.link_id)}
  `;

  if (type === "event") {
    const body = buildIcs(parseEventPayload(payload), String(row.id));
    const name = slug.endsWith(".ics") ? slug : `${slug}.ics`;
    return fileResponse(body, "text/calendar; charset=utf-8", name);
  }
  if (type === "contact") {
    const body = buildVcf(parseContactPayload(payload), String(row.id));
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
