import { getSql } from "@/lib/db";
import { uid } from "./id";
import type {
  DashGroup,
  DashSection,
  DashState,
  DashTeam,
  DashWidget,
  Tenant,
} from "./types";
import { emptyDash } from "./dashboard";

export { emptyDash };

function mapSection(r: Record<string, unknown>): DashSection {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    team_id: r.team_id ? String(r.team_id) : null,
    user_id: r.user_id ? String(r.user_id) : null,
    kind: r.kind === "team" ? "team" : "personal",
    zone: r.zone === "above" ? "above" : r.zone === "below" ? "below" : "personal",
    title: String(r.title || ""),
    sort_order: Number(r.sort_order ?? 0),
  };
}

function mapGroup(r: Record<string, unknown>): DashGroup {
  return {
    id: String(r.id),
    section_id: String(r.section_id),
    title: String(r.title || ""),
    color: String(r.color || "#64748b"),
    x: Number(r.x ?? 0),
    y: Number(r.y ?? 0),
    w: Number(r.w ?? 4),
    h: Number(r.h ?? 3),
  };
}

function mapWidget(r: Record<string, unknown>): DashWidget {
  const display = String(r.display || "text");
  return {
    id: String(r.id),
    section_id: String(r.section_id),
    group_id: r.group_id ? String(r.group_id) : null,
    short_id: r.short_id ? String(r.short_id) : null,
    resource_id: r.resource_id ? String(r.resource_id) : null,
    label: String(r.label || ""),
    display: display === "icon" || display === "preview" ? display : "text",
    icon: String(r.icon || "link"),
    image_url: r.image_url ? String(r.image_url) : null,
    show_clicks: Boolean(r.show_clicks),
    show_last_click: Boolean(r.show_last_click),
    x: Number(r.x ?? 0),
    y: Number(r.y ?? 0),
    w: Number(r.w ?? 2),
    h: Number(r.h ?? 2),
    created_by: r.created_by ? String(r.created_by) : null,
  };
}

export async function ensureDashSeed(tenantId: string, userId: string): Promise<void> {
  const sql = await getSql();
  const personal = await sql`
    select id from db_dash_sections
    where tenant_id = ${tenantId} and kind = 'personal' and user_id = ${userId}
    limit 1
  `;
  if (!personal.length) {
    await sql`
      insert into db_dash_sections (id, tenant_id, user_id, kind, zone, title, sort_order)
      values (${uid("dsec")}, ${tenantId}, ${userId}, ${"personal"}, ${"personal"}, ${""}, ${1})
    `;
  }
}

export async function loadDashState(
  tenantId: string,
  userId: string,
  teamId?: string | null,
  userButtons: Tenant["dash_user_buttons"] = "anywhere",
): Promise<DashState> {
  const sql = await getSql();
  try {
    await ensureDashSeed(tenantId, userId);
    const teamRows = await sql`select * from db_teams where tenant_id = ${tenantId} order by name`;
    const teamsList = teamRows as { id: string; tenant_id: string; name: string }[];
    const useTeam = teamId || teamsList[0]?.id || null;

    const [memberRows, sectionRows, groupRows, widgetRows] = await Promise.all([
      sql`
        select m.team_id, m.user_id from db_team_members m
        join db_teams t on t.id = m.team_id
        where t.tenant_id = ${tenantId}
      `,
      useTeam
        ? sql`
            select * from db_dash_sections
            where tenant_id = ${tenantId}
              and (
                (kind = 'personal' and user_id = ${userId})
                or (kind = 'team' and team_id = ${useTeam})
              )
            order by
              case zone when 'above' then 0 when 'personal' then 1 else 2 end,
              sort_order
          `
        : sql`
            select * from db_dash_sections
            where tenant_id = ${tenantId} and kind = 'personal' and user_id = ${userId}
            order by sort_order
          `,
      sql`select g.* from db_dash_groups g
          join db_dash_sections s on s.id = g.section_id
          where s.tenant_id = ${tenantId}`,
      sql`select w.* from db_dash_widgets w
          join db_dash_sections s on s.id = w.section_id
          where s.tenant_id = ${tenantId}`,
    ]);

    const membersByTeam = new Map<string, string[]>();
    for (const row of memberRows as { team_id: string; user_id: string }[]) {
      const list = membersByTeam.get(row.team_id) || [];
      list.push(row.user_id);
      membersByTeam.set(row.team_id, list);
    }

    const sections = (sectionRows as Record<string, unknown>[]).map(mapSection);
    const sectionIds = new Set(sections.map((s) => s.id));

    return {
      user_buttons: userButtons,
      teams: teamsList.map((r) => ({
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        name: String(r.name),
        member_ids: membersByTeam.get(String(r.id)) || [],
      })),
      active_team_id: useTeam,
      sections,
      groups: (groupRows as Record<string, unknown>[])
        .map(mapGroup)
        .filter((g) => sectionIds.has(g.section_id)),
      widgets: (widgetRows as Record<string, unknown>[])
        .map(mapWidget)
        .filter((w) => sectionIds.has(w.section_id)),
    };
  } catch {
    return emptyDash(userButtons);
  }
}

export async function nextCell(sectionId: string): Promise<{ x: number; y: number }> {
  const sql = await getSql();
  const rows = await sql`select x, y, w, h from db_dash_widgets where section_id = ${sectionId}`;
  let y = 0;
  for (const r of rows as { y: number; h: number }[]) {
    y = Math.max(y, Number(r.y) + Number(r.h));
  }
  return { x: 0, y };
}

export async function pinShortToDash(opts: {
  tenantId: string;
  userId: string;
  shortId: string;
  label: string;
  image?: string | null;
  display?: DashWidget["display"];
  showClicks?: boolean;
  showLast?: boolean;
}): Promise<void> {
  const sql = await getSql();
  await ensureDashSeed(opts.tenantId, opts.userId);
  const section = (
    await sql`
      select id from db_dash_sections
      where tenant_id = ${opts.tenantId} and kind = 'personal' and user_id = ${opts.userId}
      limit 1
    `
  )[0] as { id?: string } | undefined;
  if (!section?.id) return;
  const existing = await sql`
    select id from db_dash_widgets where section_id = ${section.id} and short_id = ${opts.shortId} limit 1
  `;
  if (existing.length) return;
  const pos = await nextCell(section.id);
  await sql`
    insert into db_dash_widgets (
      id, section_id, short_id, label, display, image_url,
      show_clicks, show_last_click, x, y, w, h, created_by
    ) values (
      ${uid("dwid")}, ${section.id}, ${opts.shortId}, ${opts.label},
      ${opts.display || "text"}, ${opts.image || null},
      ${opts.showClicks !== false}, ${Boolean(opts.showLast)},
      ${pos.x}, ${pos.y}, ${2}, ${2}, ${opts.userId}
    )
  `;
}
