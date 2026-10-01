import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import {
  SUPER_ADMIN_EMAIL,
  getSuperAdminPassword,
  PLATFORM_LINK_HOST,
} from "./secrets.server";
import { defaultFeatures } from "./features";
import { FEATURE_KEYS } from "./types";
import { uid } from "./id";
import { defaultPlanCatalog } from "./plans";
import { ensurePlatformVercelDomains } from "./vercel-domains.server";

async function ensureAuthUser(
  id: string,
  email: string,
  name: string,
  password: string,
  isSuper: boolean,
): Promise<void> {
  const sql = await getSql();
  const existing = await sql`select id from "user" where id = ${id} or email = ${email}`;
  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  if (existing.length > 0) {
    const realId = String((existing[0] as { id: string }).id);
    await sql`
      update "user" set email = ${email}, name = ${name}, "updatedAt" = ${now}
      where id = ${realId}
    `;
    await sql`
      insert into db_profiles (user_id, email, name, is_super_admin)
      values (${realId}, ${email}, ${name}, ${isSuper})
      on conflict (user_id) do update set
        email = excluded.email,
        name = excluded.name,
        is_super_admin = excluded.is_super_admin
    `;
    const acc = await sql`
      select id from account
      where "userId" = ${realId} and "providerId" = 'credential'
      limit 1
    `;
    if (acc.length > 0) {
      await sql`
        update account set password = ${hash}, "updatedAt" = ${now}
        where "userId" = ${realId} and "providerId" = 'credential'
      `;
    } else {
      await sql`
        insert into account (
          id, "accountId", "providerId", "userId", password,
          "createdAt", "updatedAt"
        ) values (
          ${`acc_${realId}`}, ${realId}, 'credential', ${realId}, ${hash},
          ${now}, ${now}
        )
      `;
    }
    return;
  }
  await sql`
    insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
    values (${id}, ${name}, ${email}, true, null, ${now}, ${now})
  `;
  await sql`
    insert into account (
      id, "accountId", "providerId", "userId", password,
      "createdAt", "updatedAt"
    ) values (
      ${`acc_${id}`}, ${id}, 'credential', ${id}, ${hash},
      ${now}, ${now}
    )
  `;
  await sql`
    insert into db_profiles (user_id, email, name, is_super_admin)
    values (${id}, ${email}, ${name}, ${isSuper})
    on conflict (user_id) do update set is_super_admin = excluded.is_super_admin
  `;
}

async function writeFeatures(
  tenantId: string,
  map: ReturnType<typeof defaultFeatures>,
) {
  const sql = await getSql();
  await Promise.all(
    FEATURE_KEYS.map(
      (key) => sql`
        insert into db_features (tenant_id, feature_key, enabled)
        values (${tenantId}, ${key}, ${map[key]})
        on conflict (tenant_id, feature_key) do update set enabled = excluded.enabled
      `,
    ),
  );
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `ws-${uid("").slice(0, 6)}`
  );
}

/** Only seeds Super Admin – no demo tenant/users. Cached per process. */
let seedOnce: Promise<void> | null = null;

export async function ensurePlatformSeeded(): Promise<void> {
  if (!seedOnce) {
    seedOnce = seedPlatformNow().catch((err) => {
      seedOnce = null;
      throw err;
    });
  }
  await seedOnce;
  void ensurePlatformVercelDomains();
}

async function seedPlatformNow(): Promise<void> {
  const superPassword = getSuperAdminPassword();
  if (superPassword) {
    await ensureAuthUser(
      "user_super",
      SUPER_ADMIN_EMAIL,
      "Mario Kempter",
      superPassword,
      true,
    );
  }
  const sql = await getSql();
  const hasPlan = await sql`select id from db_plans limit 1`;
  if (hasPlan.length === 0) {
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

  const oldHosts = ["linkth.is", "docbay.link", "docbay.net"];
  for (const old of oldHosts) {
    await sql`
      update db_tenants
      set domain = replace(domain, ${old}, ${PLATFORM_LINK_HOST})
      where domain like ${"%" + old}
    `;
  }
}

export async function createTenantForUser(opts: {
  userId: string;
  email: string;
  name: string;
  company: string;
  subdomain?: string;
}): Promise<string> {
  const sql = await getSql();
  const tenantId = uid("tenant");
  let sub = slugify(opts.subdomain || opts.company);

  // uniqueness
  for (let i = 0; i < 8; i++) {
    const clash = await sql`
      select id from db_tenants where subdomain = ${sub} or slug = ${sub} limit 1
    `;
    if (clash.length === 0) break;
    sub = `${slugify(opts.company)}-${uid("").slice(0, 4)}`;
  }

  await sql`
    insert into db_tenants (
      id, name, slug, subdomain, domain, custom_domain, brand_company, brand_color
    ) values (
      ${tenantId}, ${opts.company}, ${sub}, ${sub},
      ${PLATFORM_LINK_HOST}, ${""},
      ${opts.company}, ${"#1a5f4a"}
    )
  `;
  await sql`
    insert into db_tenant_members (id, tenant_id, user_id, role)
    values (${uid("mem")}, ${tenantId}, ${opts.userId}, 'owner')
  `;
  const folderId = uid("par");
  const buttonId = uid("par");
  await Promise.all([
    writeFeatures(tenantId, defaultFeatures()),
    sql`
      insert into db_email_templates (id, tenant_id, kind, subject, body_html)
      values
        (
          ${uid("tpl")}, ${tenantId}, 'access_approved',
          'Zugang freigeschaltet: {{resource_title}}',
          '<p>Ihr Zugang zu <strong>{{resource_title}}</strong> ist freigeschaltet.</p><p><a href="{{access_url}}">Öffnen</a></p>'
        ),
        (
          ${uid("tpl")}, ${tenantId}, 'click_notify',
          'Klick auf {{resource_title}}',
          '<p>{{note}} · Token {{token}}</p>'
        )
    `,
    sql`
      insert into db_email_settings (tenant_id, provider, from_email, from_name)
      values (${tenantId}, 'none', ${opts.email}, ${opts.company})
    `,
    sql`
      insert into db_profiles (user_id, email, name, is_super_admin)
      values (${opts.userId}, ${opts.email}, ${opts.name}, false)
      on conflict (user_id) do nothing
    `,
    sql`
      insert into db_param_nodes (id, tenant_id, parent_id, name, kind, show_on_home, sort_order)
      values
        (${folderId}, ${tenantId}, null, 'Vertrieb', 'folder', false, 0),
        (${buttonId}, ${tenantId}, ${folderId}, 'Direkt', 'button', true, 0)
    `,
  ]);
  return tenantId;
}

export { PLATFORM_LINK_HOST };
