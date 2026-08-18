import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";
import { ensurePlatformSeeded, createTenantForUser } from "./seed.server";
import {
  loadFullState,
  getMembership,
  isSuperAdminUser,
  listPlatformTenants,
  PLATFORM_LINK_HOST,
} from "./load-state.server";
import { featuresFromRows, defaultFeatures } from "./features";
import { FEATURE_KEYS, type EmailSettings, type JsonObject, type TenantDomain } from "./types";
import {
  uid,
  genToken,
  hashSecret,
  verifySecret,
  isBotUa,
  parseJsonArray,
  parseJsonObj,
} from "./id";
import { sendTenantEmail, renderTemplate } from "./email.server";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "./upload";
import { getGoogleClientId, getGoogleClientSecret } from "./secrets.server";
import { requestHostHeader } from "./request-host.server";
import { findTenantBrandByHost } from "./shorts.server";
import { isMarketingHost, CNAME_TARGET } from "./brand";
import { probeDomainDns } from "./dns-check.server";
import {
  ensurePlatformVercelDomains,
  ensureVercelDomain,
  removeVercelDomain,
  vercelDomainsConfigured,
} from "./vercel-domains.server";

async function audit(
  tenantId: string | null,
  userId: string | null,
  action: string,
  meta: Record<string, string | number | boolean | null> = {},
) {
  const sql = await getSql();
  await sql`
    insert into db_audit_log (id, tenant_id, user_id, action, meta)
    values (${uid("aud")}, ${tenantId}, ${userId}, ${action}, ${JSON.stringify(meta)})
  `;
}

async function notify(
  tenantId: string,
  userId: string,
  title: string,
  body: string,
  href?: string,
) {
  const sql = await getSql();
  await sql`
    insert into db_notifications (id, tenant_id, user_id, title, body, href)
    values (${uid("ntf")}, ${tenantId}, ${userId}, ${title}, ${body}, ${href ?? null})
  `;
}

async function fireWebhooks(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const sql = await getSql();
  const rows = await sql`
    select * from db_webhooks where tenant_id = ${tenantId} and enabled = true
  `;
  for (const row of rows) {
    const w = row as { url: string; events: string; secret: string | null };
    const events = parseJsonArray(w.events);
    if (!events.includes(event)) continue;
    try {
      await fetch(w.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(w.secret ? { "X-Bestlink-Secret": w.secret } : {}),
        },
        body: JSON.stringify({ event, ...payload, at: new Date().toISOString() }),
      });
    } catch {
      /* ignore */
    }
  }
}

export const bootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensurePlatformSeeded();
    const sql = await getSql();
    const profile = (
      await sql`select * from db_profiles where user_id = ${context.userId}`
    )[0] as { is_super_admin?: boolean; email?: string; name?: string } | undefined;
    const state = await loadFullState(context.userId);
    return {
      userId: context.userId,
      isSuperAdmin: Boolean(profile?.is_super_admin),
      profile: profile ? { email: profile.email, name: profile.name } : null,
      state,
    };
  });

export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensurePlatformSeeded();
  } catch (err) {
    console.error("[home] seed", err);
  }
  const google = Boolean(getGoogleClientId() && getGoogleClientSecret());
  const host = requestHostHeader();
  if (!isMarketingHost(host)) {
    const brand = await findTenantBrandByHost(host);
    return {
      mode: "miss" as const,
      product: "bestl.ink",
      tagline: "Share less. Know more.",
      slogan: "Der Link sagt alles. Der Inhalt bleibt euer.",
      platformHost: PLATFORM_LINK_HOST,
      googleNative: google,
      host,
      company: brand?.company || "",
    };
  }
  return {
    mode: "home" as const,
    product: "bestl.ink",
    tagline: "Share less. Know more.",
    slogan: "Der Link sagt alles. Der Inhalt bleibt euer.",
    platformHost: PLATFORM_LINK_HOST,
    googleNative: google,
    host,
    company: "",
  };
});

export const afterSignupSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { company: string; name?: string; subdomain?: string }) => d)
  .handler(async ({ context, data }) => {
    await ensurePlatformSeeded();
    const sql = await getSql();
    const existing = await sql`
      select id from db_tenant_members where user_id = ${context.userId} limit 1
    `;
    if (existing.length > 0) return loadFullState(context.userId);
    const session = await getSessionUser();
    const email = session?.email || `${context.userId}@users.bestl.ink`;
    await createTenantForUser({
      userId: context.userId,
      email,
      name: data.name || "Owner",
      company: data.company || "Mein Unternehmen",
      subdomain: data.subdomain,
    });
    await audit(null, context.userId, "tenant.created", {
      company: data.company || null,
    });
    return loadFullState(context.userId);
  });

export const getState = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await ensurePlatformSeeded();
    let state = await loadFullState(context.userId, data.tenant_id);
    if (!state) {
      const sql = await getSql();
      const u = (
        await sql`select email, name from "user" where id = ${context.userId} limit 1`
      )[0] as { email?: string; name?: string } | undefined;
      const email = u?.email || `${context.userId}@users.bestl.ink`;
      const name = (u?.name || email.split("@")[0] || "Owner").trim();
      await createTenantForUser({
        userId: context.userId,
        email,
        name,
        company: name,
      });
      state = await loadFullState(context.userId, data.tenant_id);
    }
    if (!state) throw new Error("Kein Workspace – bitte Account einrichten");
    if (state.tenant.suspended && !state.isSuperAdmin) {
      throw new Error("Workspace gesperrt – bitte Support kontaktieren");
    }
    return state;
  });

export const updateTenant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      name?: string;
      subdomain?: string;
      custom_domain?: string;
      custom_domain_connected?: boolean;
      brand_color?: string;
      brand_company?: string;
      tenant_id?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    if (mem.tenant.id === "platform") throw new Error("Kein Workspace gewählt");
    const sql = await getSql();
    const t = mem.tenant;

    const subdomain = (data.subdomain ?? t.subdomain)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);
    if (!subdomain) throw new Error("Subdomain erforderlich");
    if (["www", "app", "admin", "api", "cname", "mail"].includes(subdomain)) {
      throw new Error("Subdomain reserviert");
    }
    const subClash = await sql`
      select id from db_tenants where subdomain = ${subdomain} and id <> ${t.id} limit 1
    `;
    if (subClash.length) throw new Error("Subdomain bereits vergeben");

    const custom = (data.custom_domain ?? t.custom_domain ?? "")
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase();
    if (custom) {
      const cClash = await sql`
        select id from db_tenants
        where lower(custom_domain) = ${custom} and id <> ${t.id} limit 1
      `;
      if (cClash.length) throw new Error("Custom Domain bereits verknüpft");
    }

    const customConnected =
      data.custom_domain_connected ?? t.custom_domain_connected;
    const primaryHost =
      customConnected && custom ? custom : PLATFORM_LINK_HOST;

    await sql`
      update db_tenants set
        name = ${data.name ?? t.name},
        slug = ${subdomain},
        subdomain = ${subdomain},
        domain = ${primaryHost},
        custom_domain = ${custom},
        custom_domain_connected = ${customConnected},
        domain_connected = ${customConnected || true},
        brand_color = ${data.brand_color ?? t.brand_color},
        brand_company = ${data.brand_company ?? t.brand_company}
      where id = ${t.id}
    `;
    await audit(t.id, context.userId, "tenant.updated", {
      subdomain,
      custom_domain: custom || null,
    });
    return loadFullState(context.userId, t.id);
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { company: string; subdomain?: string }) => d)
  .handler(async ({ context, data }) => {
    await ensurePlatformSeeded();
    const company = data.company.trim();
    if (!company) throw new Error("Name erforderlich");
    const session = await getSessionUser();
    const email = session?.email || `${context.userId}@users.bestl.ink`;
    const name = email.split("@")[0] || "Owner";
    const tenantId = await createTenantForUser({
      userId: context.userId,
      email,
      name,
      company,
      subdomain: data.subdomain,
    });
    await audit(tenantId, context.userId, "tenant.created", { company });
    return loadFullState(context.userId, tenantId);
  });

export const addTenantDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { host: string; tags?: string[]; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    if (mem.tenant.id === "platform") throw new Error("Kein Workspace gewählt");
    const host = data.host
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase();
    if (!host || !host.includes(".")) throw new Error("Gültige Domain erforderlich");
    const sql = await getSql();
    const clash = await sql`
      select id from db_tenant_domains where lower(host) = ${host} limit 1
    `;
    if (clash.length) throw new Error("Domain bereits verknüpft");
    const tenantClash = await sql`
      select id from db_tenants where lower(custom_domain) = ${host} and id <> ${mem.tenant.id} limit 1
    `;
    if (tenantClash.length) throw new Error("Domain bereits verknüpft");
    const max = (
      await sql`
        select coalesce(max(sort_order), -1)::int as m
        from db_tenant_domains where tenant_id = ${mem.tenant.id}
      `
    )[0] as { m: number };
    await sql`
      insert into db_tenant_domains (id, tenant_id, host, connected, tags, sort_order)
      values (
        ${uid("tdom")}, ${mem.tenant.id}, ${host}, ${false},
        ${JSON.stringify(data.tags ?? [])}, ${(max?.m ?? -1) + 1}
      )
    `;
    if (!mem.tenant.custom_domain) {
      await sql`
        update db_tenants set custom_domain = ${host}, custom_domain_connected = false
        where id = ${mem.tenant.id}
      `;
    }
    await audit(mem.tenant.id, context.userId, "domain.added", { host });
    void ensurePlatformVercelDomains();
    await ensureVercelDomain(host).catch(() => undefined);
    return loadFullState(context.userId, mem.tenant.id);
  });

export const updateTenantDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      id: string;
      connected?: boolean;
      tags?: string[];
      tenant_id?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    const row = (
      await sql`
        select * from db_tenant_domains
        where id = ${data.id} and tenant_id = ${mem.tenant.id}
        limit 1
      `
    )[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("Domain nicht gefunden");
    const connected = data.connected ?? Boolean(row.connected);
    const tags = data.tags ?? parseJsonArray(row.tags);
    await sql`
      update db_tenant_domains set
        connected = ${connected},
        tags = ${JSON.stringify(tags)}
      where id = ${data.id}
    `;
    if (connected) {
      await ensureVercelDomain(String(row.host)).catch(() => undefined);
      await sql`
        update db_tenants set
          custom_domain = ${String(row.host)},
          custom_domain_connected = true
        where id = ${mem.tenant.id}
      `;
    }
    return loadFullState(context.userId, mem.tenant.id);
  });

export const removeTenantDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    const row = (
      await sql`
        select host from db_tenant_domains
        where id = ${data.id} and tenant_id = ${mem.tenant.id}
        limit 1
      `
    )[0] as { host?: string } | undefined;
    await sql`
      delete from db_tenant_domains where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;
    if (row?.host) {
      await removeVercelDomain(row.host).catch(() => undefined);
    }
    if (row?.host && mem.tenant.custom_domain === row.host) {
      const next = (
        await sql`
          select host, connected from db_tenant_domains
          where tenant_id = ${mem.tenant.id}
          order by connected desc, created_at asc
          limit 1
        `
      )[0] as { host?: string; connected?: boolean } | undefined;
      await sql`
        update db_tenants set
          custom_domain = ${next?.host ?? ""},
          custom_domain_connected = ${Boolean(next?.connected)}
        where id = ${mem.tenant.id}
      `;
    }
    return loadFullState(context.userId, mem.tenant.id);
  });

export const verifyTenantDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    const row = (
      await sql`
        select * from db_tenant_domains
        where id = ${data.id} and tenant_id = ${mem.tenant.id}
        limit 1
      `
    )[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("Domain nicht gefunden");
    const host = String(row.host);
    const probe = await probeDomainDns(host);
    void ensurePlatformVercelDomains();
    const vercel = await ensureVercelDomain(host);
    await sql`
      update db_tenant_domains set dns_ok = ${probe.ok} where id = ${data.id}
    `;
    const domain: TenantDomain = {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      host,
      connected: Boolean(row.connected),
      dns_ok: probe.ok,
      tags: parseJsonArray(row.tags),
      sort_order: Number(row.sort_order ?? 0),
      created_at: new Date(row.created_at as string).toISOString(),
    };
    return {
      domain,
      ok: probe.ok,
      detail: probe.ok
        ? vercel.ok
          ? `${probe.detail}. ${vercel.detail}`
          : `${probe.detail}. Vercel: ${vercel.detail}`
        : probe.detail,
      vercel,
    };
  });

export const vercelDomainSetup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    void ensurePlatformVercelDomains();
    return {
      ready: await vercelDomainsConfigured(),
      cname: CNAME_TARGET,
    };
  });

export const reorderTenantDomains = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { ids: string[]; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    await Promise.all(
      data.ids.map(
        (id, i) => sql`
          update db_tenant_domains set sort_order = ${i}
          where id = ${id} and tenant_id = ${mem.tenant.id}
        `,
      ),
    );
    return { ids: data.ids };
  });

export const createResource = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      type: "document" | "page" | "event" | "contact";
      title: string;
      slug: string;
      description?: string;
      content_url?: string;
      content_base64?: string;
      upload_id?: string;
      mime_type?: string;
      file_name?: string;
      file_size?: number;
      payload?: JsonObject;
      allow_download?: boolean;
      require_nda?: boolean;
      nda_text?: string;
      tags?: string[];
      tenant_id?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    if (data.file_size && data.file_size > MAX_UPLOAD_BYTES) {
      throw new Error(`Datei zu groß (max. ${MAX_UPLOAD_LABEL})`);
    }
    if (data.content_base64 && data.content_base64.length > 1_500_000) {
      throw new Error(`Große Dateien bitte über den Upload (max. ${MAX_UPLOAD_LABEL})`);
    }
    const sql = await getSql();
    const id = uid("res");
    const slug = data.slug.replace(/^\//, "").replace(/\/$/, "");
    let contentUrl = data.content_url ?? null;
    let contentB64 = data.content_base64 ?? null;
    if (data.upload_id) {
      const { commitUpload, storageContentUrl } = await import("./storage.server");
      const key = await commitUpload(data.upload_id, mem.tenant.id, id);
      contentUrl = storageContentUrl(key);
      contentB64 = null;
    }
    await sql`
      insert into db_resources (
        id, tenant_id, type, title, slug, description,
        content_url, content_base64, mime_type, file_name, file_size,
        allow_download, require_nda, nda_text, payload, tags
      ) values (
        ${id}, ${mem.tenant.id}, ${data.type}, ${data.title}, ${slug}, ${data.description ?? ""},
        ${contentUrl}, ${contentB64},
        ${data.mime_type ?? null}, ${data.file_name ?? null}, ${data.file_size ?? null},
        ${data.allow_download ?? true}, ${data.require_nda ?? false},
        ${data.nda_text ?? "Ich akzeptiere die Vertraulichkeitsvereinbarung."},
        ${JSON.stringify(data.payload ?? {})},
        ${JSON.stringify(data.tags ?? [])}
      )
    `;
    await audit(mem.tenant.id, context.userId, "resource.created", { id, slug });
    return loadFullState(context.userId, mem.tenant.id);
  });

export const uploadBegin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      file_name: string;
      mime_type: string;
      file_size: number;
      tenant_id?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    if (data.file_size > MAX_UPLOAD_BYTES) {
      throw new Error(`Datei zu groß (max. ${MAX_UPLOAD_LABEL})`);
    }
    const { beginTempUpload } = await import("./storage.server");
    const upload_id = await beginTempUpload({
      file_name: data.file_name,
      mime_type: data.mime_type,
      file_size: data.file_size,
      user_id: context.userId,
      tenant_id: mem.tenant.id,
    });
    return { upload_id, tenant_id: mem.tenant.id };
  });

export const uploadChunk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { upload_id: string; data: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    const { assertTempUploadOwner, appendTempChunk } = await import("./storage.server");
    await assertTempUploadOwner(data.upload_id, context.userId, mem.tenant.id);
    return appendTempChunk(data.upload_id, data.data);
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    const row = (
      await sql`select content_url from db_resources where id = ${data.id} and tenant_id = ${mem.tenant.id}`
    )[0] as { content_url: string | null } | undefined;
    if (row?.content_url?.startsWith("storage:")) {
      const { deleteStoredFile, storageKeyFromUrl } = await import("./storage.server");
      await deleteStoredFile(storageKeyFromUrl(row.content_url));
    }
    await sql`delete from db_resources where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const updateResource = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      id: string;
      title?: string;
      slug?: string;
      description?: string;
      payload?: JsonObject;
      tags?: string[];
      file_name?: string;
      tenant_id?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    const sql = await getSql();
    const existing = (
      await sql`select * from db_resources where id = ${data.id} and tenant_id = ${mem.tenant.id}`
    )[0] as Record<string, unknown> | undefined;
    if (!existing) throw new Error("Nicht gefunden");
    const slug = (data.slug ?? String(existing.slug))
      .replace(/^\//, "")
      .replace(/\/$/, "");
    await sql`
      update db_resources set
        title = ${data.title ?? String(existing.title)},
        slug = ${slug},
        description = ${data.description ?? String(existing.description ?? "")},
        payload = ${JSON.stringify(data.payload ?? parseJsonObj(existing.payload))},
        tags = ${JSON.stringify(data.tags ?? parseJsonArray(existing.tags))},
        file_name = ${data.file_name ?? (existing.file_name as string | null)}
      where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;
    await audit(mem.tenant.id, context.userId, "resource.updated", { id: data.id, slug });
    return loadFullState(context.userId, mem.tenant.id);
  });

export const createParamNode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      name: string;
      kind: "folder" | "button";
      parent_id?: string | null;
      show_on_home?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    const id = uid("param");
    await sql`
      insert into db_param_nodes (id, tenant_id, parent_id, name, kind, show_on_home, sort_order)
      values (
        ${id}, ${mem.tenant.id}, ${data.parent_id ?? null}, ${data.name}, ${data.kind},
        ${data.show_on_home ?? false}, 0
      )
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const updateParamNode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; name?: string; show_on_home?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    const cur = (
      await sql`select * from db_param_nodes where id = ${data.id} and tenant_id = ${mem.tenant.id}`
    )[0] as { name: string; show_on_home: boolean } | undefined;
    if (!cur) throw new Error("Nicht gefunden");
    await sql`
      update db_param_nodes set
        name = ${data.name ?? cur.name},
        show_on_home = ${data.show_on_home ?? cur.show_on_home}
      where id = ${data.id}
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const deleteParamNode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    await sql`delete from db_param_nodes where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const createTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { name: string; color?: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    const { normalizeTagColor } = await import("./tags");
    await sql`
      insert into db_tags (id, tenant_id, name, color)
      values (
        ${uid("tag")},
        ${mem.tenant.id},
        ${data.name.trim().toLowerCase()},
        ${normalizeTagColor(data.color)}
      )
      on conflict (tenant_id, name) do update set color = excluded.color
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const updateTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; name?: string; color?: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    const { normalizeTagColor } = await import("./tags");
    const cur = (
      await sql`select name, color from db_tags where id = ${data.id} and tenant_id = ${mem.tenant.id}`
    )[0] as { name?: string; color?: string } | undefined;
    if (!cur) throw new Error("Tag nicht gefunden");
    await sql`
      update db_tags set
        name = ${data.name ? data.name.trim().toLowerCase() : String(cur.name)},
        color = ${data.color ? normalizeTagColor(data.color) : String(cur.color ?? "#64748b")}
      where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`delete from db_tags where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const createUtmPreset = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      name: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`
      insert into db_utm_presets (id, tenant_id, name, utm_source, utm_medium, utm_campaign)
      values (
        ${uid("utm")}, ${mem.tenant.id}, ${data.name},
        ${data.utm_source ?? null}, ${data.utm_medium ?? null}, ${data.utm_campaign ?? null}
      )
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const deleteUtmPreset = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`delete from db_utm_presets where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const generateLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      resource_id: string;
      button_id: string;
      note?: string;
      tags?: string[];
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_term?: string;
      utm_content?: string;
      expires_hours?: number | null;
      one_time?: boolean;
      password?: string;
      allow_download?: boolean;
      require_nda?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
    const sql = await getSql();
    const features = (
      await sql`select feature_key, enabled from db_features where tenant_id = ${mem.tenant.id}`
    ) as { feature_key: string; enabled: boolean }[];
    const fmap = featuresFromRows(features, defaultFeatures());
    if (data.one_time && !fmap.one_time_links) throw new Error("Einmal-Links deaktiviert");
    if (data.password && !fmap.password_links) throw new Error("Passwort-Links deaktiviert");

    let token = genToken(10);
    for (let i = 0; i < 6; i++) {
      const clash = await sql`select id from db_links where token = ${token}`;
      if (clash.length === 0) break;
      token = genToken(10);
    }
    const id = uid("link");
    const expires =
      data.expires_hours && data.expires_hours > 0
        ? new Date(Date.now() + data.expires_hours * 3600_000).toISOString()
        : null;
    const pwHash = data.password ? await hashSecret(data.password) : null;
    await sql`
      insert into db_links (
        id, tenant_id, token, resource_id, button_id, created_by, note, tags,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        expires_at, one_time, password_hash, allow_download, require_nda
      ) values (
        ${id}, ${mem.tenant.id}, ${token}, ${data.resource_id}, ${data.button_id},
        ${context.userId}, ${data.note ?? ""}, ${JSON.stringify(data.tags ?? [])},
        ${data.utm_source ?? null}, ${data.utm_medium ?? null}, ${data.utm_campaign ?? null},
        ${data.utm_term ?? null}, ${data.utm_content ?? null},
        ${expires}, ${data.one_time ?? false}, ${pwHash},
        ${data.allow_download ?? null}, ${data.require_nda ?? null}
      )
    `;
    await audit(mem.tenant.id, context.userId, "link.created", { id, token });
    const state = await loadFullState(context.userId, mem.tenant.id);
    const link = state?.links.find((l) => l.id === id);
    return { state, link, token, public_host: mem.tenant.public_host };
  });

export const bulkGenerateLinks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: { resource_id: string; button_id: string; lines: string[] }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const state0 = await loadFullState(context.userId, mem.tenant.id);
    if (!state0?.features.bulk_links) throw new Error("Bulk-Links deaktiviert");
    const sql = await getSql();
    const tokens: string[] = [];
    for (const line of data.lines.slice(0, 100)) {
      const note = line.trim();
      if (!note) continue;
      const token = genToken(10);
      const id = uid("link");
      await sql`
        insert into db_links (
          id, tenant_id, token, resource_id, button_id, created_by, note, tags
        ) values (
          ${id}, ${mem.tenant.id}, ${token}, ${data.resource_id}, ${data.button_id},
          ${context.userId}, ${note}, ${"[]"}
        )
      `;
      tokens.push(token);
    }
    await audit(mem.tenant.id, context.userId, "link.bulk", {
      count: tokens.length,
    });
    return {
      state: await loadFullState(context.userId, mem.tenant.id),
      tokens,
    };
  });

export const revokeLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`
      update db_links set revoked = true
      where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;
    await audit(mem.tenant.id, context.userId, "link.revoked", { id: data.id });
    return loadFullState(context.userId, mem.tenant.id);
  });

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      id: string;
      status: "pending" | "approved" | "rejected";
      origin?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`
      update db_access_requests set status = ${data.status}
      where id = ${data.id} and tenant_id = ${mem.tenant.id}
    `;

    if (data.status === "approved") {
      const req = (
        await sql`
          select a.*, r.title as resource_title, r.slug as resource_slug
          from db_access_requests a
          join db_resources r on r.id = a.resource_id
          where a.id = ${data.id}
        `
      )[0] as Record<string, unknown> | undefined;

      if (req) {
        const token = genToken(10);
        let buttonId = mem.member.param_button_id;
        if (!buttonId) {
          const b = (
            await sql`
              select id from db_param_nodes
              where tenant_id = ${mem.tenant.id} and kind = 'button' limit 1
            `
          )[0] as { id: string } | undefined;
          buttonId = b?.id ?? null;
        }
        if (buttonId) {
          const linkId = uid("link");
          await sql`
            insert into db_links (
              id, tenant_id, token, resource_id, button_id, created_by, note, tags
            ) values (
              ${linkId}, ${mem.tenant.id}, ${token}, ${String(req.resource_id)},
              ${buttonId}, ${context.userId},
              ${`Freigabe für ${String(req.email)}`}, ${JSON.stringify(["freigabe"])}
            )
          `;
          const host = mem.tenant.public_host;
          const origin = data.origin || `https://${host}`;
          const slug = String(req.resource_slug);
          const path = slug.includes(".") ? `/${slug}` : `/${slug}/`;
          const accessUrl = `${origin}${path}?access=${token}`;

          const tpl = (
            await sql`
              select * from db_email_templates
              where tenant_id = ${mem.tenant.id} and kind = 'access_approved'
            `
          )[0] as { subject: string; body_html: string } | undefined;

          const settingsRow = (
            await sql`select * from db_email_settings where tenant_id = ${mem.tenant.id}`
          )[0] as unknown as EmailSettings | undefined;

          const featRows = (await sql`
            select feature_key, enabled from db_features where tenant_id = ${mem.tenant.id}
          `) as { feature_key: string; enabled: boolean }[];
          const fmap = featuresFromRows(featRows, defaultFeatures());

          if (tpl && settingsRow) {
            const vars = {
              resource_title: String(req.resource_title),
              access_url: accessUrl,
              company: mem.tenant.brand_company || mem.tenant.name,
              email: String(req.email),
            };
            await sendTenantEmail(settingsRow, fmap, {
              to: String(req.email),
              subject: renderTemplate(tpl.subject, vars),
              html: renderTemplate(tpl.body_html, vars),
            });
          }
          await fireWebhooks(mem.tenant.id, "access_approved", {
            email: req.email,
            resource: req.resource_title,
            access_url: accessUrl,
          });
        }
      }
    }
    await audit(mem.tenant.id, context.userId, "request." + data.status, {
      id: data.id,
    });
    return loadFullState(context.userId, mem.tenant.id);
  });

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      provider: "none" | "emailit_platform" | "emailit_custom" | "smtp";
      emailit_api_key?: string;
      smtp_host?: string;
      smtp_port?: number;
      smtp_user?: string;
      smtp_pass?: string;
      smtp_secure?: boolean;
      from_email?: string;
      from_name?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const state = await loadFullState(context.userId, mem.tenant.id);
    if (!state) throw new Error("Kein Workspace");
    if (data.provider === "emailit_platform" && !state.features.emailit_platform) {
      throw new Error("Platform-Emailit nicht freigeschaltet (Super Admin)");
    }
    if (data.provider === "emailit_custom" && !state.features.emailit_custom) {
      throw new Error("Eigene Emailit-API deaktiviert");
    }
    if (data.provider === "smtp" && !state.features.smtp_email) {
      throw new Error("SMTP deaktiviert");
    }
    const sql = await getSql();
    const prev = (
      await sql`select * from db_email_settings where tenant_id = ${mem.tenant.id}`
    )[0] as unknown as EmailSettings | undefined;

    const apiKey =
      data.emailit_api_key && !data.emailit_api_key.includes("••")
        ? data.emailit_api_key
        : prev?.emailit_api_key ?? null;
    const smtpPass =
      data.smtp_pass && !data.smtp_pass.includes("••")
        ? data.smtp_pass
        : prev?.smtp_pass ?? null;

    await sql`
      insert into db_email_settings (
        tenant_id, provider, emailit_api_key, smtp_host, smtp_port, smtp_user, smtp_pass,
        smtp_secure, from_email, from_name, updated_at
      ) values (
        ${mem.tenant.id}, ${data.provider}, ${apiKey},
        ${data.smtp_host ?? null}, ${data.smtp_port ?? 587}, ${data.smtp_user ?? null},
        ${smtpPass}, ${data.smtp_secure ?? true},
        ${data.from_email ?? null}, ${data.from_name ?? null}, now()
      )
      on conflict (tenant_id) do update set
        provider = excluded.provider,
        emailit_api_key = excluded.emailit_api_key,
        smtp_host = excluded.smtp_host,
        smtp_port = excluded.smtp_port,
        smtp_user = excluded.smtp_user,
        smtp_pass = excluded.smtp_pass,
        smtp_secure = excluded.smtp_secure,
        from_email = excluded.from_email,
        from_name = excluded.from_name,
        updated_at = now()
    `;
    await audit(mem.tenant.id, context.userId, "email.settings", {
      provider: data.provider,
    });
    return loadFullState(context.userId, mem.tenant.id);
  });

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      kind: "access_approved" | "click_notify";
      subject: string;
      body_html: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem || mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    await sql`
      insert into db_email_templates (id, tenant_id, kind, subject, body_html)
      values (${uid("tpl")}, ${mem.tenant.id}, ${data.kind}, ${data.subject}, ${data.body_html})
      on conflict (tenant_id, kind) do update set
        subject = excluded.subject, body_html = excluded.body_html
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const saveWebhook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { url: string; events?: string[]; secret?: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const state = await loadFullState(context.userId, mem.tenant.id);
    if (!state?.features.webhooks) throw new Error("Webhooks deaktiviert");
    const sql = await getSql();
    await sql`
      insert into db_webhooks (id, tenant_id, url, events, secret)
      values (
        ${uid("wh")}, ${mem.tenant.id}, ${data.url},
        ${JSON.stringify(data.events ?? ["click", "access_request", "access_approved"])},
        ${data.secret ?? null}
      )
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`delete from db_webhooks where id = ${data.id} and tenant_id = ${mem.tenant.id}`;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId, data.tenant_id);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    await sql`
      update db_notifications set read = true
      where user_id = ${context.userId} and tenant_id = ${mem.tenant.id}
    `;
    return loadFullState(context.userId, mem.tenant.id);
  });

export const superListTenants = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensurePlatformSeeded();
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    return listPlatformTenants();
  });

export const superSetFeature = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: { tenant_id: string; feature_key: string; enabled: boolean }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    if (!(FEATURE_KEYS as readonly string[]).includes(data.feature_key)) {
      throw new Error("Unknown feature");
    }
    await sql`
      insert into db_features (tenant_id, feature_key, enabled)
      values (${data.tenant_id}, ${data.feature_key}, ${data.enabled})
      on conflict (tenant_id, feature_key) do update set enabled = excluded.enabled
    `;
    await audit(data.tenant_id, context.userId, "super.feature", {
      feature: data.feature_key,
      enabled: data.enabled,
    });
    const { loadSuperAdmin } = await import("./admin.server");
    return loadSuperAdmin();
  });

export const superGetAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensurePlatformSeeded();
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { loadSuperAdmin } = await import("./admin.server");
    return loadSuperAdmin();
  });

export const superSavePlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      id?: string;
      name: string;
      slug?: string;
      kind: "appsumo" | "monthly" | "custom";
      description?: string;
      features: Record<string, boolean>;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { createPlan, updatePlan, loadSuperAdmin } = await import("./admin.server");
    const { parsePlanFeatures } = await import("./plans");
    const features = parsePlanFeatures(data.features);
    if (data.id) {
      await updatePlan({
        id: data.id,
        name: data.name,
        kind: data.kind,
        description: data.description,
        features,
      });
    } else {
      await createPlan({
        name: data.name,
        slug: data.slug,
        kind: data.kind,
        description: data.description,
        features,
      });
    }
    await audit(null, context.userId, data.id ? "super.plan.update" : "super.plan.create", {
      name: data.name,
    });
    return loadSuperAdmin();
  });

export const superDeletePlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { deletePlan, loadSuperAdmin } = await import("./admin.server");
    await deletePlan(data.id);
    await audit(null, context.userId, "super.plan.delete", { id: data.id });
    return loadSuperAdmin();
  });

export const superAssignPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id: string; plan_id: string | null }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { assignPlan, loadSuperAdmin } = await import("./admin.server");
    await assignPlan(data.tenant_id, data.plan_id);
    await audit(data.tenant_id, context.userId, "super.plan.assign", {
      plan_id: data.plan_id,
    });
    return loadSuperAdmin();
  });

export const superUpdateTenant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      tenant_id: string;
      name?: string;
      notes?: string;
      suspended?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { updateTenantAdmin, loadSuperAdmin } = await import("./admin.server");
    await updateTenantAdmin(data);
    await audit(data.tenant_id, context.userId, "super.tenant.update", {
      suspended: data.suspended ?? null,
    });
    return loadSuperAdmin();
  });

export const superUpdateUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { user_id: string; name?: string; email?: string }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { updateUserAdmin, loadSuperAdmin } = await import("./admin.server");
    await updateUserAdmin(data);
    await audit(null, context.userId, "super.user.update", { user_id: data.user_id });
    return loadSuperAdmin();
  });

export const superResetPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { user_id: string; password: string }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { resetUserPassword, loadSuperAdmin } = await import("./admin.server");
    await resetUserPassword(data.user_id, data.password);
    await audit(null, context.userId, "super.user.password", { user_id: data.user_id });
    return loadSuperAdmin();
  });

export const superSetMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: { tenant_id: string; user_id: string; role: "owner" | "admin" | "member" }) =>
      d,
  )
  .handler(async ({ context, data }) => {
    if (!(await isSuperAdminUser(context.userId))) throw new Error("Forbidden");
    const { setMemberRole, loadSuperAdmin } = await import("./admin.server");
    await setMemberRole(data.tenant_id, data.user_id, data.role);
    await audit(data.tenant_id, context.userId, "super.member.role", {
      user_id: data.user_id,
      role: data.role,
    });
    return loadSuperAdmin();
  });

export const resolveAccess = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: string;
      token?: string | null;
      password?: string;
      nda_email?: string;
      user_agent?: string;
      ip_hint?: string;
      host?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await ensurePlatformSeeded();
    const sql = await getSql();
    const slug = data.slug.replace(/^\//, "").replace(/\/$/, "");

    let resRows: unknown[] = [];
    const host = (data.host || "").toLowerCase().replace(/:\d+$/, "");
    if (host) {
      const sub =
        host.endsWith(`.${PLATFORM_LINK_HOST}`)
          ? host.slice(0, -(PLATFORM_LINK_HOST.length + 1))
          : null;
      resRows = await sql`
        select r.*, t.name as tenant_name, t.domain, t.brand_color, t.brand_company, t.id as tenant_id
        from db_resources r
        join db_tenants t on t.id = r.tenant_id
        where r.slug = ${slug}
          and (
            lower(t.custom_domain) = ${host}
            or lower(t.domain) = ${host}
            or (${sub} is not null and t.subdomain = ${sub})
            or exists (
              select 1 from db_tenant_domains d
              where d.tenant_id = t.id and lower(d.host) = ${host}
            )
          )
        limit 1
      `;
    }
    if (resRows.length === 0) {
      resRows = await sql`
        select r.*, t.name as tenant_name, t.domain, t.brand_color, t.brand_company, t.id as tenant_id
        from db_resources r
        join db_tenants t on t.id = r.tenant_id
        where r.slug = ${slug}
        order by t.created_at desc
        limit 1
      `;
    }
    if (resRows.length === 0) throw new Error("NOT_FOUND");
    const resource = resRows[0] as Record<string, unknown>;
    const tenantId = String(resource.tenant_id);

    const featRows = (await sql`
      select feature_key, enabled from db_features where tenant_id = ${tenantId}
    `) as { feature_key: string; enabled: boolean }[];
    const features = featuresFromRows(featRows, defaultFeatures());

    const base = {
      resource: {
        id: String(resource.id),
        type: String(resource.type) as "document" | "page" | "event" | "contact",
        title: String(resource.title),
        slug: String(resource.slug),
        description: String(resource.description ?? ""),
        mime_type: (resource.mime_type as string) ?? null,
        file_name: (resource.file_name as string) ?? null,
        allow_download: Boolean(resource.allow_download),
        require_nda: Boolean(resource.require_nda),
        nda_text: String(resource.nda_text ?? ""),
        payload: parseJsonObj(resource.payload),
      },
      settings: {
        company_name: String(resource.brand_company || resource.tenant_name),
        domain: String(resource.domain ?? ""),
        brand_color: String(resource.brand_color ?? "#1a5f4a"),
      },
      features: {
        chat: features.chat,
        watermarks: features.watermarks,
        pdf_analytics: features.pdf_analytics,
        page_proxy: features.page_proxy,
        nda: features.nda,
        download_control: features.download_control,
      },
      access: "missing" as "missing" | "denied" | "password" | "nda" | "granted",
      content_data_url: null as string | null,
      target_url: null as string | null,
      download_url: null as string | null,
      link: null as null | {
        id: string;
        token: string;
        note: string;
        button_name: string;
        allow_download: boolean;
      },
    };

    if (!data.token) return base;

    const linkRows = await sql`
      select l.*, p.name as button_name
      from db_links l
      left join db_param_nodes p on p.id = l.button_id
      where l.token = ${data.token} and l.resource_id = ${String(resource.id)}
    `;
    if (linkRows.length === 0) return { ...base, access: "denied" as const };
    const link = linkRows[0] as Record<string, unknown>;
    if (link.revoked) return { ...base, access: "denied" as const };
    if (link.expires_at && new Date(link.expires_at as string).getTime() < Date.now()) {
      return { ...base, access: "denied" as const };
    }
    if (link.one_time && link.used_at) return { ...base, access: "denied" as const };

    if (link.password_hash) {
      const ok = await verifySecret(data.password || "", String(link.password_hash));
      if (!ok) return { ...base, access: "password" as const };
    }

    const requireNda =
      link.require_nda != null
        ? Boolean(link.require_nda)
        : Boolean(resource.require_nda);
    if (requireNda && features.nda) {
      const email = (data.nda_email || "").trim().toLowerCase();
      if (!email) return { ...base, access: "nda" as const };
      const accepted = await sql`
        select id from db_nda_acceptances
        where link_id = ${String(link.id)} and email = ${email}
      `;
      if (accepted.length === 0) {
        await sql`
          insert into db_nda_acceptances (id, link_id, email)
          values (${uid("nda")}, ${String(link.id)}, ${email})
        `;
      }
    }

    const ua = data.user_agent || "";
    const bot = isBotUa(ua);
    const ipHash = await hashSecret(data.ip_hint || ua || "unknown");
    const kindEarly = String(resource.type);
    const isCard = kindEarly === "event" || kindEarly === "contact";

    if (!isCard) {
      await sql`
        insert into db_clicks (id, link_id, tenant_id, is_bot, user_agent, ip_hash)
        values (${uid("click")}, ${String(link.id)}, ${tenantId}, ${bot}, ${ua}, ${ipHash})
      `;
      await sql`
        update db_links set
          click_count = click_count + 1,
          human_click_count = human_click_count + ${bot ? 0 : 1},
          last_clicked_at = now(),
          used_at = case when one_time and used_at is null then now() else used_at end
        where id = ${String(link.id)}
      `;

      if (!bot && features.notifications) {
        const creator = link.created_by ? String(link.created_by) : null;
        if (creator) {
          await notify(
            tenantId,
            creator,
            `Klick: ${String(resource.title)}`,
            `${String(link.note || "Link")} · Mensch`,
            "/control/links",
          );
        }
      }

      await fireWebhooks(tenantId, "click", {
        token: link.token,
        resource: resource.title,
        bot,
        note: link.note,
      });
    }

    let content_data_url: string | null = null;
    let target_url: string | null = null;
    if (resource.type === "document") {
      const curl = resource.content_url ? String(resource.content_url) : "";
      if (curl.startsWith("storage:")) {
        content_data_url = `/api/files/${resource.id}?access=${encodeURIComponent(String(link.token))}`;
      } else if (resource.content_base64) {
        content_data_url = `data:${resource.mime_type || "application/pdf"};base64,${resource.content_base64}`;
      } else if (curl) {
        content_data_url = curl;
      }
    } else if (features.page_proxy) {
      target_url = (resource.content_url as string) || null;
    }

    const kind = String(resource.type);
    const download_url =
      kind === "event" || kind === "contact"
        ? `/api/cards/${resource.id}?access=${encodeURIComponent(String(link.token))}`
        : null;

    const allowDl =
      link.allow_download != null
        ? Boolean(link.allow_download)
        : Boolean(resource.allow_download);

    return {
      ...base,
      access: "granted" as const,
      content_data_url,
      target_url,
      download_url,
      link: {
        id: String(link.id),
        token: String(link.token),
        note: String(link.note ?? ""),
        button_name: String(link.button_name ?? ""),
        allow_download: allowDl,
      },
    };
  });

export const trackView = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      link_id: string;
      page?: number;
      duration_ms?: number;
      scroll_pct?: number;
    }) => d,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const link = (
      await sql`select tenant_id from db_links where id = ${data.link_id}`
    )[0] as { tenant_id: string } | undefined;
    if (!link) return { ok: false };
    await sql`
      insert into db_view_events (id, link_id, tenant_id, page, duration_ms, scroll_pct)
      values (
        ${uid("view")}, ${data.link_id}, ${link.tenant_id},
        ${data.page ?? 1}, ${data.duration_ms ?? 0}, ${data.scroll_pct ?? 0}
      )
    `;
    return { ok: true };
  });

export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      resource_id: string;
      email: string;
      phone?: string;
      message?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await ensurePlatformSeeded();
    const sql = await getSql();
    const res = (
      await sql`select tenant_id, title from db_resources where id = ${data.resource_id}`
    )[0] as { tenant_id: string; title: string } | undefined;
    if (!res) throw new Error("NOT_FOUND");
    const id = uid("req");
    await sql`
      insert into db_access_requests (id, tenant_id, resource_id, email, phone, message)
      values (
        ${id}, ${res.tenant_id}, ${data.resource_id}, ${data.email},
        ${data.phone ?? null}, ${data.message ?? null}
      )
    `;
    const owners = await sql`
      select user_id from db_tenant_members
      where tenant_id = ${res.tenant_id} and role in ('owner', 'admin')
    `;
    for (const o of owners) {
      await notify(
        res.tenant_id,
        String((o as { user_id: string }).user_id),
        "Neue Zugriffsanfrage",
        `${data.email} · ${res.title}`,
        "/control/requests",
      );
    }
    await fireWebhooks(res.tenant_id, "access_request", {
      email: data.email,
      resource: res.title,
    });
    return { ok: true, id };
  });

export const listChat = createServerFn({ method: "POST" })
  .inputValidator((d: { resource_id: string; link_id?: string; visitor_key?: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql`
      select * from db_chat_messages
      where resource_id = ${data.resource_id}
      order by created_at asc
      limit 200
    `;
    return rows.map((r) => {
      const m = r as Record<string, unknown>;
      return {
        id: String(m.id),
        sender_type: String(m.sender_type),
        sender_name: String(m.sender_name),
        body: String(m.body),
        created_at: new Date(m.created_at as string).toISOString(),
      };
    });
  });

export const postChat = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      resource_id: string;
      link_id?: string;
      visitor_key?: string;
      sender_type: "visitor" | "staff";
      sender_name: string;
      body: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const res = (
      await sql`select tenant_id from db_resources where id = ${data.resource_id}`
    )[0] as { tenant_id: string } | undefined;
    if (!res) throw new Error("NOT_FOUND");
    const id = uid("chat");
    await sql`
      insert into db_chat_messages (
        id, tenant_id, resource_id, link_id, visitor_key, sender_type, sender_name, body
      ) values (
        ${id}, ${res.tenant_id}, ${data.resource_id}, ${data.link_id ?? null},
        ${data.visitor_key ?? null}, ${data.sender_type}, ${data.sender_name}, ${data.body}
      )
    `;
    return { ok: true, id };
  });

export const getLinkAnalytics = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { link_id: string }) => d)
  .handler(async ({ context, data }) => {
    const mem = await getMembership(context.userId);
    if (!mem) throw new Error("Kein Workspace");
    const sql = await getSql();
    const views = (
      await sql`
      select page, avg(duration_ms)::int as avg_ms, count(*)::int as c
      from db_view_events
      where link_id = ${data.link_id} and tenant_id = ${mem.tenant.id}
      group by page order by page
    `
    ).map((r) => {
      const row = r as { page: number; avg_ms: number; c: number };
      return {
        page: Number(row.page),
        avg_ms: Number(row.avg_ms),
        c: Number(row.c),
      };
    });
    const clicks = (
      await sql`
      select is_bot, count(*)::int as c from db_clicks
      where link_id = ${data.link_id}
      group by is_bot
    `
    ).map((r) => {
      const row = r as { is_bot: boolean; c: number };
      return { is_bot: Boolean(row.is_bot), c: Number(row.c) };
    });
    return { views, clicks };
  });
