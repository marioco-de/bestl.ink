import { getSql } from "@/lib/db";
import type {
  AccessRequest,
  AuditEntry,
  EmailSettings,
  EmailTemplate,
  FullState,
  GeneratedLink,
  Member,
  NdaRecord,
  Notification,
  ParamNode,
  Resource,
  SuperTenantRow,
  TeamGoalRow,
  Tenant,
  TenantDomain,
  Webhook,
  WorkspaceSummary,
} from "./types";
import { featuresFromRows, defaultFeatures } from "./features";
import { parseJsonArray, parseJsonObj } from "./id";
import { ensurePlatformSeeded, PLATFORM_LINK_HOST } from "./seed.server";
import { mapShortRow } from "./shorts.server";
import { emptyDash, loadDashState } from "./dashboard.server";
import { loadPresenceMap } from "./activity.server";

function publicHost(subdomain: string, custom: string, customConnected: boolean): string {
  if (customConnected && custom) return custom;
  // Apex works on the live Vercel deploy. Workspace subdomains need a
  // project-owned wildcard (*.bestl.ink), which this host cannot set.
  return PLATFORM_LINK_HOST;
}

export function mapTenant(r: Record<string, unknown>): Tenant {
  const subdomain = String(r.subdomain || r.slug || "");
  const custom = String(r.custom_domain || "");
  const customConnected = Boolean(r.custom_domain_connected ?? r.domain_connected);
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    subdomain,
    domain: String(r.domain || publicHost(subdomain, custom, customConnected)),
    custom_domain: custom,
    custom_domain_connected: customConnected,
    domain_connected: Boolean(r.domain_connected),
    is_demo: Boolean(r.is_demo),
    demo_reset_at: r.demo_reset_at
      ? new Date(r.demo_reset_at as string).toISOString()
      : null,
    brand_logo_url: (r.brand_logo_url as string) ?? null,
    brand_color: String(r.brand_color ?? "#1a5f4a"),
    brand_company: String(r.brand_company ?? ""),
    created_at: new Date(r.created_at as string).toISOString(),
    public_host: publicHost(subdomain, custom, customConnected),
    plan_id: r.plan_id ? String(r.plan_id) : null,
    suspended: Boolean(r.suspended),
    notes: String(r.notes ?? ""),
    dash_user_buttons: (
      ["off", "anywhere", "above", "below"].includes(String(r.dash_user_buttons))
        ? String(r.dash_user_buttons)
        : "anywhere"
    ) as Tenant["dash_user_buttons"],
  };
}

function mapLink(row: Record<string, unknown>): GeneratedLink {
  const uniqueIps = row.unique_ips != null ? Number(row.unique_ips) : undefined;
  const human = Number(row.human_click_count ?? 0);
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    token: String(row.token),
    resource_id: String(row.resource_id),
    button_id: String(row.button_id),
    created_by: (row.created_by as string) ?? null,
    note: String(row.note ?? ""),
    tags: parseJsonArray(row.tags),
    utm_source: (row.utm_source as string) ?? null,
    utm_medium: (row.utm_medium as string) ?? null,
    utm_campaign: (row.utm_campaign as string) ?? null,
    utm_term: (row.utm_term as string) ?? null,
    utm_content: (row.utm_content as string) ?? null,
    click_count: Number(row.click_count ?? 0),
    human_click_count: human,
    last_clicked_at: row.last_clicked_at
      ? new Date(row.last_clicked_at as string).toISOString()
      : null,
    revoked: Boolean(row.revoked),
    expires_at: row.expires_at
      ? new Date(row.expires_at as string).toISOString()
      : null,
    one_time: Boolean(row.one_time),
    used_at: row.used_at ? new Date(row.used_at as string).toISOString() : null,
    password_hash: (row.password_hash as string) ?? null,
    allow_download:
      row.allow_download === null || row.allow_download === undefined
        ? null
        : Boolean(row.allow_download),
    require_nda:
      row.require_nda === null || row.require_nda === undefined
        ? null
        : Boolean(row.require_nda),
    created_at: new Date(row.created_at as string).toISOString(),
    resource_title: row.resource_title ? String(row.resource_title) : undefined,
    resource_slug: row.resource_slug ? String(row.resource_slug) : undefined,
    resource_type: row.resource_type
      ? (String(row.resource_type) as GeneratedLink["resource_type"])
      : undefined,
    button_name: row.button_name ? String(row.button_name) : undefined,
    unique_ips: uniqueIps,
    share_suspected: uniqueIps != null ? uniqueIps >= 3 && human >= 3 : false,
  };
}

export async function isSuperAdminUser(userId: string): Promise<boolean> {
  await ensurePlatformSeeded();
  const sql = await getSql();
  const row = (
    await sql`select is_super_admin from db_profiles where user_id = ${userId}`
  )[0] as { is_super_admin?: boolean } | undefined;
  return Boolean(row?.is_super_admin);
}

export async function listPlatformTenants(): Promise<SuperTenantRow[]> {
  const sql = await getSql();
  const tenants = await sql`select * from db_tenants order by created_at desc`;
  const out: SuperTenantRow[] = [];
  for (const t of tenants) {
    const row = t as Record<string, unknown>;
    const tid = String(row.id);
    const featRows = (await sql`
      select feature_key, enabled from db_features where tenant_id = ${tid}
    `) as { feature_key: string; enabled: boolean }[];
    const [mc] = await sql`select count(*)::int as c from db_tenant_members where tenant_id = ${tid}`;
    const [lc] = await sql`select count(*)::int as c from db_links where tenant_id = ${tid}`;
    out.push({
      tenant: mapTenant(row),
      features: featuresFromRows(featRows, defaultFeatures()),
      memberCount: Number((mc as { c: number }).c),
      linkCount: Number((lc as { c: number }).c),
      plan_id: row.plan_id ? String(row.plan_id) : null,
      plan_name: null,
      plan_kind: null,
      owners: [],
    });
  }
  return out;
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  const sql = await getSql();
  const rows = await sql`
    select t.id, t.name, t.subdomain, m.role
    from db_tenant_members m
    join db_tenants t on t.id = m.tenant_id
    where m.user_id = ${userId}
    order by t.name
  `;
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.name),
      subdomain: String(row.subdomain || ""),
      role: String(row.role) as WorkspaceSummary["role"],
    };
  });
}

export async function listTenantDomains(tenantId: string): Promise<TenantDomain[]> {
  const sql = await getSql();
  const rows = await sql`
    select id, tenant_id, host, connected, dns_ok, tags, sort_order, created_at
    from db_tenant_domains
    where tenant_id = ${tenantId}
    order by sort_order asc, created_at asc
  `;
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      host: String(row.host),
      connected: Boolean(row.connected),
      dns_ok: Boolean(row.dns_ok),
      tags: parseJsonArray(row.tags),
      sort_order: Number(row.sort_order ?? 0),
      created_at: new Date(row.created_at as string).toISOString(),
    };
  });
}

export async function getMembership(
  userId: string,
  tenantId?: string,
): Promise<{ tenant: Tenant; member: Member } | null> {
  await ensurePlatformSeeded();
  const sql = await getSql();
  const superAdmin = await isSuperAdminUser(userId);

  // Super admin can open any tenant by id without membership
  if (tenantId && superAdmin) {
    const tRows = await sql`select * from db_tenants where id = ${tenantId} limit 1`;
    if (tRows[0]) {
      return {
        tenant: mapTenant(tRows[0] as Record<string, unknown>),
        member: {
          id: "super",
          tenant_id: tenantId,
          user_id: userId,
          role: "owner",
          param_button_id: null,
        },
      };
    }
  }

  let rows;
  if (tenantId) {
    rows = await sql`
      select m.*, t.id as t_id, t.name as t_name, t.slug, t.subdomain, t.domain,
             t.custom_domain, t.custom_domain_connected, t.domain_connected,
             t.is_demo, t.demo_reset_at, t.brand_logo_url, t.brand_color, t.brand_company, t.created_at as t_created
      from db_tenant_members m
      join db_tenants t on t.id = m.tenant_id
      where m.user_id = ${userId} and m.tenant_id = ${tenantId}
      limit 1
    `;
  } else {
    rows = await sql`
      select m.*, t.id as t_id, t.name as t_name, t.slug, t.subdomain, t.domain,
             t.custom_domain, t.custom_domain_connected, t.domain_connected,
             t.is_demo, t.demo_reset_at, t.brand_logo_url, t.brand_color, t.brand_company, t.created_at as t_created
      from db_tenant_members m
      join db_tenants t on t.id = m.tenant_id
      where m.user_id = ${userId}
      order by m.created_at asc
      limit 1
    `;
  }
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  const tenant = mapTenant({
    id: r.t_id,
    name: r.t_name,
    slug: r.slug,
    subdomain: r.subdomain,
    domain: r.domain,
    custom_domain: r.custom_domain,
    custom_domain_connected: r.custom_domain_connected,
    domain_connected: r.domain_connected,
    is_demo: r.is_demo,
    demo_reset_at: r.demo_reset_at,
    brand_logo_url: r.brand_logo_url,
    brand_color: r.brand_color,
    brand_company: r.brand_company,
    created_at: r.t_created,
  });
  const member: Member = {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    user_id: String(r.user_id),
    role: String(r.role) as Member["role"],
    param_button_id: (r.param_button_id as string) ?? null,
  };
  return { tenant, member };
}

export async function loadFullState(
  userId: string,
  tenantId?: string,
): Promise<FullState | null> {
  const superAdmin = await isSuperAdminUser(userId);
  let mem = await getMembership(userId, tenantId);

  // Super admin without own workspace: still show platform panel
  if (!mem && superAdmin) {
    const platformTenants = await listPlatformTenants();
    const emptyTenant: Tenant = {
      id: "platform",
      name: "BESTL.INK Platform",
      slug: "platform",
      subdomain: "admin",
      domain: `admin.${PLATFORM_LINK_HOST}`,
      custom_domain: "",
      custom_domain_connected: false,
      domain_connected: true,
      is_demo: false,
      demo_reset_at: null,
      brand_logo_url: null,
      brand_color: "#1a5f4a",
      brand_company: "BESTL.INK",
      created_at: new Date().toISOString(),
      public_host: `admin.${PLATFORM_LINK_HOST}`,
      plan_id: null,
      suspended: false,
      notes: "",
      dash_user_buttons: "anywhere",
    };
    return {
      tenant: emptyTenant,
      member: {
        id: "super",
        tenant_id: "platform",
        user_id: userId,
        role: "owner",
        param_button_id: null,
      },
      features: defaultFeatures(),
      resources: [],
      params: [],
      tags: [],
      workspaces: await listWorkspacesForUser(userId),
      domains: [],
      utmPresets: [],
      links: [],
      requests: [],
      stats: {
        resources: 0,
        links: 0,
        clicks: 0,
        human_clicks: 0,
        pending_requests: 0,
        buttons: 0,
        unread_notifications: 0,
        shorts: 0,
        short_clicks: 0,
        unread_chat: 0,
      },
      teamGoals: [],
      emailSettings: null,
      emailTemplates: [],
      webhooks: [],
      notifications: [],
      audit: [],
      members: [],
      shorts: [],
      apiKeys: [],
      dash: emptyDash(),
      demoResetsInMs: null,
      isSuperAdmin: true,
      platformTenants,
    };
  }

  if (!mem) return null;
  const { tenant, member } = mem;
  const sql = await getSql();
  const tid = tenant.id;

  if (tid === "platform") {
    return {
      tenant,
      member,
      features: defaultFeatures(),
      resources: [],
      params: [],
      tags: [],
      workspaces: await listWorkspacesForUser(userId),
      domains: [],
      utmPresets: [],
      links: [],
      requests: [],
      stats: {
        resources: 0,
        links: 0,
        clicks: 0,
        human_clicks: 0,
        pending_requests: 0,
        buttons: 0,
        unread_notifications: 0,
        shorts: 0,
        short_clicks: 0,
        unread_chat: 0,
      },
      teamGoals: [],
      emailSettings: null,
      emailTemplates: [],
      webhooks: [],
      notifications: [],
      audit: [],
      members: [],
      shorts: [],
      apiKeys: [],
      dash: emptyDash(),
      demoResetsInMs: null,
      isSuperAdmin: true,
      platformTenants: await listPlatformTenants(),
    };
  }

  const [
    featRows,
    resourceRows,
    paramRows,
    tagRows,
    workspaces,
    domains,
    utmPresets,
    linkRows,
    reqRows,
    countRow,
    goalRows,
    emailSettingsRows,
    emailTemplateRows,
    webhookRows,
    notificationRows,
    auditRows,
    memberRows,
    shortRows,
    apiKeyRows,
    platformTenants,
  ] = await Promise.all([
    sql`select feature_key, enabled from db_features where tenant_id = ${tid}`,
    sql`select * from db_resources where tenant_id = ${tid} order by created_at desc`,
    sql`select * from db_param_nodes where tenant_id = ${tid} order by sort_order, created_at`,
    sql`select id, name, color from db_tags where tenant_id = ${tid} order by name`,
    listWorkspacesForUser(userId),
    listTenantDomains(tid),
    sql`select * from db_utm_presets where tenant_id = ${tid} order by name`,
    sql`
      select l.*, r.title as resource_title, r.slug as resource_slug, r.type as resource_type,
             p.name as button_name
      from db_links l
      join db_resources r on r.id = l.resource_id
      left join db_param_nodes p on p.id = l.button_id
      where l.tenant_id = ${tid}
      order by l.created_at desc
    `,
    sql`
      select a.*, r.title as resource_title
      from db_access_requests a
      join db_resources r on r.id = a.resource_id
      where a.tenant_id = ${tid}
      order by a.created_at desc
    `,
    sql`
      select
        (select count(*)::int from db_resources where tenant_id = ${tid}) as resources,
        (select count(*)::int from db_links where tenant_id = ${tid} and revoked = false) as links,
        (select coalesce(sum(click_count),0)::int from db_links where tenant_id = ${tid}) as clicks,
        (select coalesce(sum(human_click_count),0)::int from db_links where tenant_id = ${tid}) as human_clicks,
        (select count(*)::int from db_access_requests where tenant_id = ${tid} and status = 'pending') as pending_requests,
        (select count(*)::int from db_param_nodes where tenant_id = ${tid} and kind = 'button') as buttons,
        (select count(*)::int from db_notifications where user_id = ${userId} and tenant_id = ${tid} and read = false) as unread_notifications,
        (select count(*)::int from db_short_links where tenant_id = ${tid}) as shorts,
        (select coalesce(sum(click_count),0)::int from db_short_links where tenant_id = ${tid}) as short_clicks,
        (select count(*)::int from (
          select distinct on (c.resource_id, coalesce(c.visitor_key, '')) c.sender_type
          from db_chat_messages c
          where c.tenant_id = ${tid}
          order by c.resource_id, coalesce(c.visitor_key, ''), c.created_at desc
        ) waiting where waiting.sender_type = 'visitor') as unread_chat
    `,
    sql`
      select p.id as button_id, p.name,
        count(l.id)::int as links,
        coalesce(sum(l.human_click_count),0)::int as human_clicks,
        count(*) filter (where l.human_click_count >= 3)::int as hot_links
      from db_param_nodes p
      left join db_links l on l.button_id = p.id and l.revoked = false
      where p.tenant_id = ${tid} and p.kind = 'button'
      group by p.id, p.name
      order by p.name
    `,
    sql`select * from db_email_settings where tenant_id = ${tid}`,
    sql`select * from db_email_templates where tenant_id = ${tid}`,
    sql`select * from db_webhooks where tenant_id = ${tid} order by created_at desc`,
    sql`
      select * from db_notifications where user_id = ${userId} and tenant_id = ${tid}
      order by created_at desc limit 50
    `,
    sql`
      select * from db_audit_log where tenant_id = ${tid}
      order by created_at desc limit 40
    `,
    sql`
      select m.*, p.email, p.name
      from db_tenant_members m
      left join db_profiles p on p.user_id = m.user_id
      where m.tenant_id = ${tid}
    `,
    sql`
      select s.*, p.name as button_name
      from db_short_links s
      left join db_param_nodes p on p.id = s.button_id
      where s.tenant_id = ${tid}
      order by s.created_at desc
    `,
    sql`
      select id, tenant_id, name, prefix, created_at
      from db_api_keys where tenant_id = ${tid}
      order by created_at desc
    `,
    superAdmin ? listPlatformTenants() : Promise.resolve(undefined),
  ]);

  const dash = await loadDashState(tid, userId, undefined, tenant.dash_user_buttons);

  const features = featuresFromRows(
    featRows as { feature_key: string; enabled: boolean }[],
    defaultFeatures(),
  );

  const resources = resourceRows.map((row) => {
    const r = row as unknown as Resource;
    return {
      ...r,
      content_base64: r.content_base64 ? "1" : null,
      payload: parseJsonObj((r as unknown as { payload?: unknown }).payload),
      tags: parseJsonArray((r as unknown as { tags?: unknown }).tags),
      allow_download: Boolean(r.allow_download),
      require_nda: Boolean(r.require_nda),
      file_size: r.file_size != null ? Number(r.file_size) : null,
      created_at: new Date(r.created_at).toISOString(),
    };
  });

  const params = paramRows.map((row) => {
    const r = row as unknown as ParamNode;
    return {
      ...r,
      show_on_home: Boolean(r.show_on_home),
      sort_order: Number(r.sort_order),
    };
  });

  const tags = tagRows as { id: string; name: string; color: string }[];
  const primaryDomain = domains.find((d) => d.connected);
  if (primaryDomain) {
    tenant.public_host = primaryDomain.host;
    tenant.custom_domain = primaryDomain.host;
    tenant.custom_domain_connected = true;
  }

  let links = linkRows.map((r) => mapLink(r as Record<string, unknown>));
  try {
    const ndaRows = await sql`
      select n.id, n.link_id, n.email, n.accepted_at,
             coalesce(n.ip, '') as ip, coalesce(n.user_agent, '') as user_agent
      from db_nda_acceptances n
      join db_links l on l.id = n.link_id
      where l.tenant_id = ${tid}
      order by n.accepted_at desc
    `;
    const byLink = new Map<string, NdaRecord[]>();
    for (const row of ndaRows) {
      const r = row as Record<string, unknown>;
      const lid = String(r.link_id);
      const rec: NdaRecord = {
        id: String(r.id),
        email: String(r.email || ""),
        accepted_at: new Date(r.accepted_at as string).toISOString(),
        ip: String(r.ip || ""),
        user_agent: String(r.user_agent || ""),
      };
      const list = byLink.get(lid) || [];
      list.push(rec);
      byLink.set(lid, list);
    }
    links = links.map((l) => ({ ...l, ndas: byLink.get(l.id) || [] }));
  } catch {
    links = links.map((l) => ({ ...l, ndas: [] }));
  }
  if (member.role === "member" && !superAdmin) {
    links = links.filter(
      (l) =>
        l.created_by === userId ||
        (member.param_button_id && l.button_id === member.param_button_id),
    );
  }

  const requests = reqRows.map((row) => {
    const r = row as unknown as AccessRequest;
    return { ...r, created_at: new Date(r.created_at).toISOString() };
  });

  const counts = (countRow[0] || {}) as Record<string, number>;

  const teamGoals = goalRows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      button_id: String(row.button_id),
      name: String(row.name),
      links: Number(row.links),
      human_clicks: Number(row.human_clicks),
      hot_links: Number(row.hot_links),
    } satisfies TeamGoalRow;
  });

  let emailSettings: EmailSettings | null = null;
  if (emailSettingsRows[0]) {
    const e = emailSettingsRows[0] as unknown as EmailSettings;
    emailSettings = {
      ...e,
      smtp_port: e.smtp_port != null ? Number(e.smtp_port) : null,
      smtp_secure: Boolean(e.smtp_secure),
      emailit_api_key: e.emailit_api_key ? "••••••••" : null,
      smtp_pass: e.smtp_pass ? "••••••••" : null,
    };
  }

  const emailTemplates = emailTemplateRows as unknown as EmailTemplate[];

  const webhooks = webhookRows.map((row) => {
    const w = row as Record<string, unknown>;
    return {
      id: String(w.id),
      tenant_id: String(w.tenant_id),
      url: String(w.url),
      events: parseJsonArray(w.events),
      secret: w.secret ? "••••" : null,
      enabled: Boolean(w.enabled),
    } satisfies Webhook;
  });

  const notifications = notificationRows.map((row) => {
    const n = row as unknown as Notification;
    return {
      ...n,
      read: Boolean(n.read),
      created_at: new Date(n.created_at).toISOString(),
    };
  });

  const audit = auditRows.map((row) => {
    const a = row as Record<string, unknown>;
    const raw = parseJsonObj(a.meta);
    const meta: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null
      ) {
        meta[k] = v;
      } else {
        meta[k] = String(v);
      }
    }
    return {
      id: String(a.id),
      tenant_id: (a.tenant_id as string) ?? null,
      user_id: (a.user_id as string) ?? null,
      action: String(a.action),
      meta,
      created_at: new Date(a.created_at as string).toISOString(),
    } satisfies AuditEntry;
  });

  const members = memberRows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      user_id: String(r.user_id),
      role: String(r.role) as Member["role"],
      param_button_id: (r.param_button_id as string) ?? null,
      email: r.email ? String(r.email) : undefined,
      name: r.name ? String(r.name) : undefined,
    };
  });

  const shorts = shortRows.map((r) => mapShortRow(r as Record<string, unknown>));
  const presence = await loadPresenceMap(tid);
  links = links.map((l) => ({ ...l, presence: presence.links.get(l.id) || null }));
  const shortsWithPresence = shorts.map((s) => ({
    ...s,
    presence: presence.shorts.get(s.id) || null,
  }));
  const apiKeys = apiKeyRows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      tenant_id: String(x.tenant_id),
      name: String(x.name),
      prefix: String(x.prefix),
      created_at: new Date(x.created_at as string).toISOString(),
    };
  });

  return {
    tenant,
    member,
    features,
    resources,
    params,
    tags,
    workspaces,
    domains,
    utmPresets: utmPresets as FullState["utmPresets"],
    links,
    requests,
    stats: {
      resources: Number(counts.resources ?? 0),
      links: Number(counts.links ?? 0),
      clicks: Number(counts.clicks ?? 0),
      human_clicks: Number(counts.human_clicks ?? 0),
      pending_requests: Number(counts.pending_requests ?? 0),
      buttons: Number(counts.buttons ?? 0),
      unread_notifications: Number(counts.unread_notifications ?? 0),
      shorts: Number(counts.shorts ?? 0),
      short_clicks: Number(counts.short_clicks ?? 0),
      unread_chat: Number(counts.unread_chat ?? 0),
    },
    teamGoals,
    emailSettings,
    emailTemplates,
    webhooks,
    notifications,
    audit,
    members,
    shorts: shortsWithPresence,
    apiKeys,
    dash,
    demoResetsInMs: null,
    isSuperAdmin: superAdmin,
    platformTenants,
  };
}

export { PLATFORM_LINK_HOST };
