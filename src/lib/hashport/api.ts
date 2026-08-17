import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type {
  AccessRequest,
  FullState,
  GeneratedLink,
  ParamNode,
  PublicResourceView,
  Resource,
  Settings,
  Tag,
  UtmPreset,
} from "./types";

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LEN = 5;

function uid(prefix = ""): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${id}` : id;
}

function genToken(): string {
  let out = "";
  for (let i = 0; i < TOKEN_LEN; i++) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)]!;
  }
  return out;
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapLink(row: Record<string, unknown>): GeneratedLink {
  return {
    id: String(row.id),
    token: String(row.token),
    resource_id: String(row.resource_id),
    button_id: String(row.button_id),
    note: String(row.note ?? ""),
    tags: parseTags(row.tags),
    utm_source: (row.utm_source as string) ?? null,
    utm_medium: (row.utm_medium as string) ?? null,
    utm_campaign: (row.utm_campaign as string) ?? null,
    utm_term: (row.utm_term as string) ?? null,
    utm_content: (row.utm_content as string) ?? null,
    click_count: Number(row.click_count ?? 0),
    last_clicked_at: row.last_clicked_at
      ? new Date(row.last_clicked_at as string | Date).toISOString()
      : null,
    revoked: Boolean(row.revoked),
    created_at: new Date(row.created_at as string | Date).toISOString(),
    resource_title: row.resource_title ? String(row.resource_title) : undefined,
    resource_slug: row.resource_slug ? String(row.resource_slug) : undefined,
    resource_type: row.resource_type
      ? (String(row.resource_type) as GeneratedLink["resource_type"])
      : undefined,
    button_name: row.button_name ? String(row.button_name) : undefined,
  };
}

function minimalPdfBase64(): string {
  const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 24 Tf 72 720 Td (Verkaufsfolder Markisen - Muster GmbH) Tj ET
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000386 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
459
%%EOF`;
  return Buffer.from(pdf, "utf8").toString("base64");
}

async function ensureSeeded(): Promise<void> {
  const sql = await getSql();
  const existing = await sql`select id from hp_settings where id = 'default'`;
  if (existing.length > 0) return;

  await sql`
    insert into hp_settings (id, company_name, domain, domain_connected, brand_color)
    values ('default', 'Muster GmbH', 'docs.muster-gmbh.de', true, '#1a5f4a')
  `;

  const folderId = "param_mitarbeiter";
  const tomId = "param_tom";
  const maxId = "param_max";
  await sql`
    insert into hp_param_nodes (id, parent_id, name, kind, show_on_home, sort_order)
    values
      (${folderId}, null, 'Mitarbeiter', 'folder', false, 0),
      (${tomId}, ${folderId}, 'Tom', 'button', true, 0),
      (${maxId}, ${folderId}, 'Max', 'button', true, 1)
  `;

  await sql`
    insert into hp_tags (id, name, color) values
      ('tag_interessent', 'interessent', '#0d9488'),
      ('tag_kunde', 'kunde', '#2563eb'),
      ('tag_partner', 'partner', '#7c3aed')
  `;

  await sql`
    insert into hp_utm_presets (id, name, utm_source, utm_medium, utm_campaign)
    values
      ('utm_google', 'Google Ads', 'google', 'cpc', 'markisen-q3'),
      ('utm_newsletter', 'Newsletter', 'newsletter', 'email', 'sommer')
  `;

  const minimalPdf = minimalPdfBase64();

  const docId = "res_markisen";
  const pageId = "res_samila";
  await sql`
    insert into hp_resources (
      id, type, title, slug, description,
      content_base64, mime_type, file_name, file_size
    ) values (
      ${docId}, 'document', 'Verkaufsfolder Markisen', 'folder-markisen.pdf',
      'Produktfolder Markisen und Sonnenschutz für Endkunden.',
      ${minimalPdf}, 'application/pdf', 'folder-markisen.pdf', ${minimalPdf.length}
    )
  `;
  await sql`
    insert into hp_resources (
      id, type, title, slug, description, content_url
    ) values (
      ${pageId}, 'page', 'Samila Fenster', 'samila',
      'Interne Unterseite – wird per Frame eingebettet, URL bleibt auf der Domain.',
      'https://example.com'
    )
  `;

  const linkId = "link_demo_tom";
  const token = "39jf0";
  await sql`
    insert into hp_links (
      id, token, resource_id, button_id, note, tags, click_count, last_clicked_at
    ) values (
      ${linkId}, ${token}, ${docId}, ${tomId},
      'Michael Müller, 0171-28482818',
      ${JSON.stringify(["interessent"])},
      8,
      ${new Date("2026-08-11T07:04:00").toISOString()}
    )
  `;

  for (let i = 0; i < 8; i++) {
    await sql`
      insert into hp_clicks (id, link_id, user_agent, created_at)
      values (
        ${`click_demo_${i}`},
        ${linkId},
        'Mozilla/5.0 (demo)',
        ${new Date(Date.now() - (8 - i) * 3600_000).toISOString()}
      )
    `;
  }
}

async function loadFullState(): Promise<FullState> {
  await ensureSeeded();
  const sql = await getSql();

  const settingsRows = await sql`select * from hp_settings where id = 'default'`;
  const settings = settingsRows[0] as unknown as Settings;
  settings.domain_connected = Boolean(settings.domain_connected);
  settings.created_at = new Date(settings.created_at).toISOString();
  settings.updated_at = new Date(settings.updated_at).toISOString();

  const resources = (await sql`select * from hp_resources order by created_at desc`).map(
    (r) => {
      const row = r as unknown as Resource;
      return {
        ...row,
        content_base64: null,
        file_size: row.file_size != null ? Number(row.file_size) : null,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
      };
    },
  );

  const withFlags = await Promise.all(
    resources.map(async (r) => {
      const full = await sql`
        select
          case when content_base64 is not null then true else false end as has_file,
          content_url
        from hp_resources where id = ${r.id}
      `;
      const f = full[0] as { has_file: boolean; content_url: string | null };
      return {
        ...r,
        content_url: f.content_url,
        content_base64: f.has_file ? "1" : null,
      };
    }),
  );

  const params = (
    await sql`
    select * from hp_param_nodes order by sort_order asc, created_at asc
  `
  ).map((r) => {
    const row = r as unknown as ParamNode;
    return {
      ...row,
      show_on_home: Boolean(row.show_on_home),
      sort_order: Number(row.sort_order),
      created_at: new Date(row.created_at).toISOString(),
    };
  });

  const tags = (await sql`select * from hp_tags order by name`).map((r) => {
    const row = r as unknown as Tag;
    return { ...row, created_at: new Date(row.created_at).toISOString() };
  });

  const utmPresets = (await sql`select * from hp_utm_presets order by name`).map((r) => {
    const row = r as unknown as UtmPreset;
    return { ...row, created_at: new Date(row.created_at).toISOString() };
  });

  const linkRows = await sql`
    select l.*, r.title as resource_title, r.slug as resource_slug, r.type as resource_type,
           p.name as button_name
    from hp_links l
    join hp_resources r on r.id = l.resource_id
    join hp_param_nodes p on p.id = l.button_id
    order by l.created_at desc
  `;
  const links = linkRows.map((r) => mapLink(r as Record<string, unknown>));

  const reqRows = await sql`
    select a.*, r.title as resource_title, r.slug as resource_slug
    from hp_access_requests a
    join hp_resources r on r.id = a.resource_id
    order by a.created_at desc
  `;
  const requests = reqRows.map((r) => {
    const row = r as unknown as AccessRequest;
    return {
      ...row,
      created_at: new Date(row.created_at).toISOString(),
    };
  });

  const [resCount] = await sql`select count(*)::int as c from hp_resources`;
  const [linkCount] = await sql`select count(*)::int as c from hp_links where revoked = false`;
  const [clickCount] = await sql`select coalesce(sum(click_count),0)::int as c from hp_links`;
  const [pendingCount] = await sql`
    select count(*)::int as c from hp_access_requests where status = 'pending'
  `;
  const [btnCount] = await sql`
    select count(*)::int as c from hp_param_nodes where kind = 'button'
  `;

  return {
    settings,
    resources: withFlags,
    params,
    tags,
    utmPresets,
    links,
    requests,
    stats: {
      resources: Number((resCount as { c: number }).c),
      links: Number((linkCount as { c: number }).c),
      clicks: Number((clickCount as { c: number }).c),
      pending_requests: Number((pendingCount as { c: number }).c),
      buttons: Number((btnCount as { c: number }).c),
    },
  };
}

export const getState = createServerFn({ method: "GET" }).handler(async () => {
  return loadFullState();
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      company_name?: string;
      domain?: string;
      domain_connected?: boolean;
      brand_color?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    const cur = (await sql`select * from hp_settings where id = 'default'`)[0] as unknown as Settings;
    await sql`
      update hp_settings set
        company_name = ${data.company_name ?? cur.company_name},
        domain = ${data.domain ?? cur.domain},
        domain_connected = ${data.domain_connected ?? cur.domain_connected},
        brand_color = ${data.brand_color ?? cur.brand_color},
        updated_at = now()
      where id = 'default'
    `;
    return loadFullState();
  });

export const createResource = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      type: "document" | "page";
      title: string;
      slug: string;
      description?: string;
      content_url?: string;
      content_base64?: string;
      mime_type?: string;
      file_name?: string;
      file_size?: number;
    }) => d,
  )
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    const id = uid("res");
    const slug = data.slug.replace(/^\//, "").replace(/\/$/, "");
    await sql`
      insert into hp_resources (
        id, type, title, slug, description,
        content_url, content_base64, mime_type, file_name, file_size
      ) values (
        ${id}, ${data.type}, ${data.title}, ${slug}, ${data.description ?? ""},
        ${data.content_url ?? null}, ${data.content_base64 ?? null},
        ${data.mime_type ?? null}, ${data.file_name ?? null}, ${data.file_size ?? null}
      )
    `;
    return loadFullState();
  });

export const deleteResource = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    await sql`delete from hp_resources where id = ${data.id}`;
    return loadFullState();
  });

export const createParamNode = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      kind: "folder" | "button";
      parent_id?: string | null;
      show_on_home?: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    const id = uid("param");
    const max = await sql`
      select coalesce(max(sort_order), -1)::int as m from hp_param_nodes
      where parent_id is not distinct from ${data.parent_id ?? null}
    `;
    const order = Number((max[0] as { m: number }).m) + 1;
    await sql`
      insert into hp_param_nodes (id, parent_id, name, kind, show_on_home, sort_order)
      values (
        ${id}, ${data.parent_id ?? null}, ${data.name}, ${data.kind},
        ${data.show_on_home ?? false}, ${order}
      )
    `;
    return loadFullState();
  });

export const updateParamNode = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name?: string; show_on_home?: boolean }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    const cur = (await sql`select * from hp_param_nodes where id = ${data.id}`)[0] as
      | unknown
      | undefined;
    if (!cur) throw new Error("Parameter nicht gefunden");
    const node = cur as ParamNode;
    await sql`
      update hp_param_nodes set
        name = ${data.name ?? node.name},
        show_on_home = ${data.show_on_home ?? node.show_on_home}
      where id = ${data.id}
    `;
    return loadFullState();
  });

export const deleteParamNode = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    await sql`delete from hp_param_nodes where id = ${data.id}`;
    return loadFullState();
  });

export const createTag = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; color?: string }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    const id = uid("tag");
    await sql`
      insert into hp_tags (id, name, color)
      values (${id}, ${data.name.toLowerCase()}, ${data.color ?? "#64748b"})
      on conflict (name) do nothing
    `;
    return loadFullState();
  });

export const deleteTag = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    await sql`delete from hp_tags where id = ${data.id}`;
    return loadFullState();
  });

export const createUtmPreset = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_term?: string;
      utm_content?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    const id = uid("utm");
    await sql`
      insert into hp_utm_presets (
        id, name, utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) values (
        ${id}, ${data.name}, ${data.utm_source ?? null}, ${data.utm_medium ?? null},
        ${data.utm_campaign ?? null}, ${data.utm_term ?? null}, ${data.utm_content ?? null}
      )
    `;
    return loadFullState();
  });

export const deleteUtmPreset = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    await sql`delete from hp_utm_presets where id = ${data.id}`;
    return loadFullState();
  });

export const generateLink = createServerFn({ method: "POST" })
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
    }) => d,
  )
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();

    let token = genToken();
    for (let i = 0; i < 8; i++) {
      const clash = await sql`select id from hp_links where token = ${token}`;
      if (clash.length === 0) break;
      token = genToken();
    }

    const id = uid("link");
    await sql`
      insert into hp_links (
        id, token, resource_id, button_id, note, tags,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) values (
        ${id}, ${token}, ${data.resource_id}, ${data.button_id},
        ${data.note ?? ""}, ${JSON.stringify(data.tags ?? [])},
        ${data.utm_source ?? null}, ${data.utm_medium ?? null},
        ${data.utm_campaign ?? null}, ${data.utm_term ?? null},
        ${data.utm_content ?? null}
      )
    `;

    const state = await loadFullState();
    const link = state.links.find((l) => l.id === id)!;
    return { state, link, token };
  });

export const revokeLink = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    await sql`update hp_links set revoked = true where id = ${data.id}`;
    return loadFullState();
  });

export const resolveAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; token?: string | null }) => d)
  .handler(async ({ data }): Promise<PublicResourceView> => {
    await ensureSeeded();
    const sql = await getSql();
    const slug = data.slug.replace(/^\//, "").replace(/\/$/, "");

    const resRows = await sql`select * from hp_resources where slug = ${slug}`;
    if (resRows.length === 0) {
      throw new Error("NOT_FOUND");
    }
    const resource = resRows[0] as unknown as Resource;
    const settings = (await sql`select * from hp_settings where id = 'default'`)[0] as unknown as Settings;

    const base: PublicResourceView = {
      resource: {
        id: resource.id,
        type: resource.type,
        title: resource.title,
        slug: resource.slug,
        description: resource.description,
        mime_type: resource.mime_type,
        file_name: resource.file_name,
      },
      settings: {
        company_name: settings.company_name,
        domain: settings.domain,
        brand_color: settings.brand_color,
      },
      access: "missing",
    };

    if (!data.token) {
      return base;
    }

    const linkRows = await sql`
      select l.*, p.name as button_name
      from hp_links l
      join hp_param_nodes p on p.id = l.button_id
      where l.token = ${data.token} and l.resource_id = ${resource.id}
    `;
    if (linkRows.length === 0) {
      return { ...base, access: "denied" };
    }
    const link = linkRows[0] as Record<string, unknown>;
    if (link.revoked) {
      return { ...base, access: "denied" };
    }

    const clickId = uid("click");
    await sql`
      insert into hp_clicks (id, link_id, user_agent)
      values (${clickId}, ${String(link.id)}, ${"browser"})
    `;
    await sql`
      update hp_links set
        click_count = click_count + 1,
        last_clicked_at = now()
      where id = ${String(link.id)}
    `;

    let content_data_url: string | null = null;
    let target_url: string | null = null;
    if (resource.type === "document") {
      if (resource.content_base64) {
        const mime = resource.mime_type || "application/pdf";
        content_data_url = `data:${mime};base64,${resource.content_base64}`;
      } else if (resource.content_url) {
        content_data_url = resource.content_url;
      }
    } else {
      target_url = resource.content_url;
    }

    return {
      ...base,
      access: "granted",
      content_data_url,
      content_url: resource.content_url,
      target_url,
      link: {
        id: String(link.id),
        token: String(link.token),
        note: String(link.note ?? ""),
        button_name: String(link.button_name ?? ""),
      },
    };
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
    await ensureSeeded();
    const sql = await getSql();
    const id = uid("req");
    await sql`
      insert into hp_access_requests (id, resource_id, email, phone, message)
      values (
        ${id}, ${data.resource_id}, ${data.email},
        ${data.phone ?? null}, ${data.message ?? null}
      )
    `;
    return { ok: true, id };
  });

export const updateRequestStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: "pending" | "approved" | "rejected" }) => d)
  .handler(async ({ data }) => {
    await ensureSeeded();
    const sql = await getSql();
    await sql`
      update hp_access_requests set status = ${data.status} where id = ${data.id}
    `;
    return loadFullState();
  });

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeeded();
  const sql = await getSql();
  const settings = (await sql`select * from hp_settings where id = 'default'`)[0] as unknown as Settings;
  const buttons = (
    await sql`
    select * from hp_param_nodes where kind = 'button' and show_on_home = true
    order by sort_order
  `
  ).map((r) => {
    const row = r as unknown as ParamNode;
    return {
      ...row,
      show_on_home: Boolean(row.show_on_home),
      created_at: new Date(row.created_at).toISOString(),
    };
  });
  const resources = (await sql`
    select id, type, title, slug, description from hp_resources order by title
  `) as Pick<Resource, "id" | "type" | "title" | "slug" | "description">[];
  return {
    settings: {
      ...settings,
      domain_connected: Boolean(settings.domain_connected),
    },
    buttons,
    resources,
  };
});
