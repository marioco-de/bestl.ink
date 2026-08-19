import { getSql } from "@/lib/db";
import { uid, parseJsonArray } from "./id";

const BACKOFF_MS = [12_000, 148_000, 1_808_000, 22_026_000, 86_400_000];

type HookRow = { id: string; url: string; events: string; secret: string | null };

export async function fireWebhooks(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const sql = await getSql();
  const rows = (await sql`
    select id, url, events, secret from db_webhooks
    where tenant_id = ${tenantId} and enabled = true
  `) as HookRow[];
  for (const w of rows) {
    const events = parseJsonArray(w.events);
    if (!events.includes(event)) continue;
    await deliver(w, tenantId, event, payload);
  }
  try {
    await drainRetries(tenantId, 3);
  } catch {
    /* ignore */
  }
}

async function deliver(
  w: HookRow,
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
  existing?: { id: string; attempts: number },
) {
  const sql = await getSql();
  const id = existing?.id || uid("wd");
  const attempts = (existing?.attempts ?? 0) + 1;
  const body = JSON.stringify({ event, ...payload, at: new Date().toISOString() });
  if (!existing) {
    await sql`
      insert into db_webhook_deliveries (
        id, webhook_id, tenant_id, event, payload, status, attempts
      ) values (
        ${id}, ${w.id}, ${tenantId}, ${event}, ${body}, 'pending', 0
      )
    `;
  }
  try {
    const res = await fetch(w.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(w.secret ? { "X-Bestlink-Secret": w.secret } : {}),
      },
      body,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await sql`
      update db_webhook_deliveries set
        status = 'ok', attempts = ${attempts}, last_error = '',
        next_retry_at = null, delivered_at = now()
      where id = ${id}
    `;
  } catch (e) {
    const err = e instanceof Error ? e.message.slice(0, 240) : "Fehler";
    const next =
      attempts >= BACKOFF_MS.length
        ? null
        : new Date(Date.now() + (BACKOFF_MS[attempts - 1] || 86_400_000));
    await sql`
      update db_webhook_deliveries set
        status = 'failed', attempts = ${attempts}, last_error = ${err},
        next_retry_at = ${next ? next.toISOString() : null}
      where id = ${id}
    `;
  }
}

export async function drainRetries(tenantId: string, limit = 8) {
  const sql = await getSql();
  const due = await sql`
    select d.id, d.event, d.payload, d.attempts, w.id as webhook_id, w.url, w.events, w.secret
    from db_webhook_deliveries d
    join db_webhooks w on w.id = d.webhook_id
    where d.tenant_id = ${tenantId}
      and d.status <> 'ok'
      and w.enabled = true
      and d.next_retry_at is not null
      and d.next_retry_at <= now()
    order by d.created_at asc
    limit ${limit}
  `;
  for (const row of due) {
    const r = row as Record<string, unknown>;
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(String(r.payload || "{}")) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    delete payload.event;
    delete payload.at;
    await deliver(
      {
        id: String(r.webhook_id),
        url: String(r.url),
        events: String(r.events),
        secret: r.secret ? String(r.secret) : null,
      },
      tenantId,
      String(r.event),
      payload,
      { id: String(r.id), attempts: Number(r.attempts || 0) },
    );
  }
}

export async function listWebhookDeliveries(tenantId: string, webhookId: string) {
  const sql = await getSql();
  const rows = await sql`
    select id, event, status, attempts, last_error, created_at, delivered_at, payload
    from db_webhook_deliveries
    where tenant_id = ${tenantId} and webhook_id = ${webhookId}
    order by created_at desc
    limit 40
  `;
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      event: String(r.event),
      status: String(r.status),
      attempts: Number(r.attempts || 0),
      last_error: String(r.last_error || ""),
      created_at: new Date(r.created_at as string).toISOString(),
      delivered_at: r.delivered_at ? new Date(r.delivered_at as string).toISOString() : null,
    };
  });
}

export async function retryWebhookDelivery(tenantId: string, deliveryId: string) {
  const sql = await getSql();
  const row = (
    await sql`
      select d.id, d.event, d.payload, d.attempts, w.id as webhook_id, w.url, w.events, w.secret
      from db_webhook_deliveries d
      join db_webhooks w on w.id = d.webhook_id
      where d.id = ${deliveryId} and d.tenant_id = ${tenantId}
      limit 1
    `
  )[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error("Nicht gefunden");
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(row.payload || "{}")) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  delete payload.event;
  delete payload.at;
  await deliver(
    {
      id: String(row.webhook_id),
      url: String(row.url),
      events: String(row.events),
      secret: row.secret ? String(row.secret) : null,
    },
    tenantId,
    String(row.event),
    payload,
    { id: String(row.id), attempts: Number(row.attempts || 0) },
  );
}
