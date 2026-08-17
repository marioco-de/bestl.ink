import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { FEATURE_KEYS, type FeatureKey, type FeatureMap, type MemberRole } from "./types";
import type { SuperAdminPayload, SuperTenantRow, SuperUserRow } from "./types";
import { featuresFromRows, defaultFeatures } from "./features";
import {
  defaultPlanCatalog,
  parsePlanFeatures,
  type Plan,
  type PlanKind,
} from "./plans";
import { uid } from "./id";
import { mapTenant } from "./load-state.server";

export async function seedDefaultPlans(): Promise<void> {
  const sql = await getSql();
  const existing = await sql`select id from db_plans limit 1`;
  if (existing.length > 0) return;
  for (const p of defaultPlanCatalog()) {
    await sql`
      insert into db_plans (id, name, slug, kind, description, features)
      values (
        ${uid("plan")}, ${p.name}, ${p.slug}, ${p.kind}, ${p.description},
        ${JSON.stringify(p.features)}
      )
      on conflict (slug) do nothing
    `;
  }
}

function mapPlan(row: Record<string, unknown>): Plan {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    kind: String(row.kind) as PlanKind,
    description: String(row.description ?? ""),
    features: parsePlanFeatures(row.features),
    created_at: new Date(row.created_at as string).toISOString(),
  };
}

export async function listPlans(): Promise<Plan[]> {
  const sql = await getSql();
  const rows = await sql`select * from db_plans order by kind, name`;
  return rows.map((r) => mapPlan(r as Record<string, unknown>));
}

export async function loadSuperAdmin(): Promise<SuperAdminPayload> {
  await seedDefaultPlans();
  const sql = await getSql();
  const plans = await listPlans();
  const planById = new Map(plans.map((p) => [p.id, p]));

  const tenantsRaw = await sql`select * from db_tenants order by created_at desc`;
  const tenants: SuperTenantRow[] = [];
  for (const t of tenantsRaw) {
    const row = t as Record<string, unknown>;
    const tid = String(row.id);
    const featRows = (await sql`
      select feature_key, enabled from db_features where tenant_id = ${tid}
    `) as { feature_key: string; enabled: boolean }[];
    const [mc] = await sql`select count(*)::int as c from db_tenant_members where tenant_id = ${tid}`;
    const [lc] = await sql`select count(*)::int as c from db_links where tenant_id = ${tid}`;
    const owners = (
      await sql`
        select m.user_id, m.role, coalesce(p.email, u.email, '') as email,
               coalesce(p.name, u.name, '') as name
        from db_tenant_members m
        left join db_profiles p on p.user_id = m.user_id
        left join "user" u on u.id = m.user_id
        where m.tenant_id = ${tid}
        order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end
      `
    ).map((o) => {
      const r = o as Record<string, unknown>;
      return {
        user_id: String(r.user_id),
        email: String(r.email ?? ""),
        name: String(r.name ?? ""),
        role: String(r.role) as MemberRole,
      };
    });
    const planId = row.plan_id ? String(row.plan_id) : null;
    const plan = planId ? planById.get(planId) : undefined;
    tenants.push({
      tenant: mapTenant(row),
      features: featuresFromRows(featRows, defaultFeatures()),
      memberCount: Number((mc as { c: number }).c),
      linkCount: Number((lc as { c: number }).c),
      plan_id: planId,
      plan_name: plan?.name ?? null,
      plan_kind: plan?.kind ?? null,
      owners,
    });
  }

  const userRows = await sql`
    select u.id, u.email, u.name, u."createdAt" as created_at,
           coalesce(p.is_super_admin, false) as is_super_admin
    from "user" u
    left join db_profiles p on p.user_id = u.id
    order by u."createdAt" desc
  `;
  const users: SuperUserRow[] = [];
  for (const u of userRows) {
    const r = u as Record<string, unknown>;
    const uid_ = String(r.id);
    const ws = (
      await sql`
        select m.tenant_id, m.role, t.name as tenant_name
        from db_tenant_members m
        join db_tenants t on t.id = m.tenant_id
        where m.user_id = ${uid_}
      `
    ).map((w) => {
      const wr = w as Record<string, unknown>;
      return {
        tenant_id: String(wr.tenant_id),
        tenant_name: String(wr.tenant_name),
        role: String(wr.role) as MemberRole,
      };
    });
    users.push({
      user_id: uid_,
      email: String(r.email ?? ""),
      name: String(r.name ?? ""),
      is_super_admin: Boolean(r.is_super_admin),
      created_at: new Date(r.created_at as string).toISOString(),
      workspaces: ws,
    });
  }

  return { plans, tenants, users };
}

export async function applyFeatureMap(
  tenantId: string,
  features: FeatureMap,
): Promise<void> {
  const sql = await getSql();
  for (const key of FEATURE_KEYS) {
    await sql`
      insert into db_features (tenant_id, feature_key, enabled)
      values (${tenantId}, ${key}, ${features[key]})
      on conflict (tenant_id, feature_key) do update set enabled = excluded.enabled
    `;
  }
}

export async function createPlan(data: {
  name: string;
  slug?: string;
  kind: PlanKind;
  description?: string;
  features: FeatureMap;
}): Promise<Plan> {
  const sql = await getSql();
  const id = uid("plan");
  const slug =
    (data.slug || data.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || id;
  await sql`
    insert into db_plans (id, name, slug, kind, description, features)
    values (
      ${id}, ${data.name.trim()}, ${slug}, ${data.kind},
      ${data.description ?? ""}, ${JSON.stringify(data.features)}
    )
  `;
  const row = (await sql`select * from db_plans where id = ${id}`)[0];
  return mapPlan(row as Record<string, unknown>);
}

export async function updatePlan(data: {
  id: string;
  name?: string;
  kind?: PlanKind;
  description?: string;
  features?: FeatureMap;
}): Promise<void> {
  const sql = await getSql();
  const cur = (
    await sql`select * from db_plans where id = ${data.id}`
  )[0] as Record<string, unknown> | undefined;
  if (!cur) throw new Error("Plan nicht gefunden");
  await sql`
    update db_plans set
      name = ${data.name ?? String(cur.name)},
      kind = ${data.kind ?? String(cur.kind)},
      description = ${data.description ?? String(cur.description ?? "")},
      features = ${JSON.stringify(data.features ?? parsePlanFeatures(cur.features))}
    where id = ${data.id}
  `;
}

export async function deletePlan(id: string): Promise<void> {
  const sql = await getSql();
  await sql`update db_tenants set plan_id = null where plan_id = ${id}`;
  await sql`delete from db_plans where id = ${id}`;
}

export async function assignPlan(tenantId: string, planId: string | null): Promise<void> {
  const sql = await getSql();
  if (!planId) {
    await sql`update db_tenants set plan_id = null where id = ${tenantId}`;
    return;
  }
  const plan = (
    await sql`select * from db_plans where id = ${planId}`
  )[0] as Record<string, unknown> | undefined;
  if (!plan) throw new Error("Plan nicht gefunden");
  await sql`update db_tenants set plan_id = ${planId} where id = ${tenantId}`;
  await applyFeatureMap(tenantId, parsePlanFeatures(plan.features));
}

export async function updateTenantAdmin(data: {
  tenant_id: string;
  name?: string;
  notes?: string;
  suspended?: boolean;
}): Promise<void> {
  const sql = await getSql();
  const cur = (
    await sql`select * from db_tenants where id = ${data.tenant_id}`
  )[0] as Record<string, unknown> | undefined;
  if (!cur) throw new Error("Workspace nicht gefunden");
  await sql`
    update db_tenants set
      name = ${data.name ?? String(cur.name)},
      notes = ${data.notes ?? String(cur.notes ?? "")},
      suspended = ${data.suspended ?? Boolean(cur.suspended)}
    where id = ${data.tenant_id}
  `;
}

export async function updateUserAdmin(data: {
  user_id: string;
  name?: string;
  email?: string;
}): Promise<void> {
  const sql = await getSql();
  const cur = (
    await sql`select * from "user" where id = ${data.user_id}`
  )[0] as { name?: string; email?: string } | undefined;
  if (!cur) throw new Error("Nutzer nicht gefunden");
  const email = (data.email ?? cur.email ?? "").trim().toLowerCase();
  const name = (data.name ?? cur.name ?? "").trim();
  if (email && email !== cur.email) {
    const clash = await sql`
      select id from "user" where lower(email) = ${email} and id <> ${data.user_id} limit 1
    `;
    if (clash.length) throw new Error("E-Mail bereits vergeben");
  }
  await sql`
    update "user" set name = ${name}, email = ${email}, "updatedAt" = ${new Date().toISOString()}
    where id = ${data.user_id}
  `;
  await sql`
    insert into db_profiles (user_id, email, name, is_super_admin)
    values (${data.user_id}, ${email}, ${name}, false)
    on conflict (user_id) do update set email = excluded.email, name = excluded.name
  `;
}

export async function resetUserPassword(
  userId: string,
  password: string,
): Promise<void> {
  if (password.length < 8) throw new Error("Passwort mindestens 8 Zeichen");
  const sql = await getSql();
  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  const acc = await sql`
    select id from account where "userId" = ${userId} and "providerId" = 'credential' limit 1
  `;
  if (acc.length > 0) {
    await sql`
      update account set password = ${hash}, "updatedAt" = ${now}
      where "userId" = ${userId} and "providerId" = 'credential'
    `;
  } else {
    await sql`
      insert into account (
        id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
      ) values (
        ${uid("acc")}, ${userId}, 'credential', ${userId}, ${hash}, ${now}, ${now}
      )
    `;
  }
}

export async function setMemberRole(
  tenantId: string,
  userId: string,
  role: MemberRole,
): Promise<void> {
  const sql = await getSql();
  await sql`
    update db_tenant_members set role = ${role}
    where tenant_id = ${tenantId} and user_id = ${userId}
  `;
}

export function isFeatureKey(k: string): k is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(k);
}
