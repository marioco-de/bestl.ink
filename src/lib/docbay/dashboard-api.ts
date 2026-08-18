import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getMembership } from "./load-state.server";
import { uid } from "./id";
import {
  ensureDashSeed,
  loadDashState,
  pinShortToDash,
} from "./dashboard.server";
import type { DashState, DashWidget, Tenant } from "./types";

async function dashOf(userId: string, tenantId?: string, teamId?: string | null) {
  const mem = await getMembership(userId, tenantId);
  if (!mem || mem.tenant.id === "platform") throw new Error("Kein Workspace");
  return {
    mem,
    state: await loadDashState(
      mem.tenant.id,
      userId,
      teamId,
      mem.tenant.dash_user_buttons,
    ),
  };
}

export const getDash = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; team_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const { state } = await dashOf(context.userId, data.tenant_id, data.team_id);
    return state;
  });

export const saveDashSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; user_buttons: Tenant["dash_user_buttons"] }) => d)
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id);
    if (mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    await sql`update db_tenants set dash_user_buttons = ${data.user_buttons} where id = ${mem.tenant.id}`;
    return loadDashState(mem.tenant.id, context.userId, undefined, data.user_buttons);
  });

export const createDashTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; name: string }) => d)
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id);
    if (mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    const id = uid("team");
    await sql`insert into db_teams (id, tenant_id, name) values (${id}, ${mem.tenant.id}, ${data.name.trim() || "Team"})`;
    await sql`insert into db_team_members (id, team_id, user_id, role) values (${uid("tmem")}, ${id}, ${context.userId}, ${"owner"})`;
    return loadDashState(mem.tenant.id, context.userId, id, mem.tenant.dash_user_buttons);
  });

export const addDashTeamSection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; team_id: string; zone: "above" | "below"; title?: string }) => d)
  .handler(async ({ context, data }) => {
    const { mem, state } = await dashOf(context.userId, data.tenant_id, data.team_id);
    if (mem.member.role === "member") throw new Error("Keine Berechtigung");
    const existing = state.sections.filter((s) => s.kind === "team");
    if (existing.length >= 2) throw new Error("Maximal zwei Team-Sektionen");
    if (existing.some((s) => s.zone === data.zone)) throw new Error("Diese Team-Sektion existiert schon");
    const sql = await getSql();
    await sql`
      insert into db_dash_sections (id, tenant_id, team_id, kind, zone, title, sort_order)
      values (${uid("dsec")}, ${mem.tenant.id}, ${data.team_id}, ${"team"}, ${data.zone}, ${data.title || (data.zone === "above" ? "Team oben" : "Team unten")}, ${data.zone === "above" ? 0 : 2})
    `;
    return loadDashState(mem.tenant.id, context.userId, data.team_id, mem.tenant.dash_user_buttons);
  });

export const moveDashSection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; id: string; zone: "above" | "below"; merge?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { mem, state } = await dashOf(context.userId, data.tenant_id);
    if (mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sec = state.sections.find((s) => s.id === data.id);
    if (!sec || sec.kind !== "team") throw new Error("Sektion nicht gefunden");
    const other = state.sections.find((s) => s.kind === "team" && s.zone === data.zone && s.id !== sec.id);
    const sql = await getSql();
    if (other && data.merge) {
      await sql`update db_dash_widgets set section_id = ${other.id} where section_id = ${sec.id}`;
      await sql`update db_dash_groups set section_id = ${other.id} where section_id = ${sec.id}`;
      await sql`delete from db_dash_sections where id = ${sec.id}`;
    } else {
      const max = state.sections
        .filter((s) => s.kind === "team" && s.zone === data.zone)
        .reduce((n, s) => Math.max(n, s.sort_order), data.zone === "above" ? 0 : 2);
      await sql`update db_dash_sections set zone = ${data.zone}, sort_order = ${max + 1} where id = ${sec.id}`;
    }
    return loadDashState(mem.tenant.id, context.userId, sec.team_id, mem.tenant.dash_user_buttons);
  });

export const saveDashWidget = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: Partial<DashWidget> & { tenant_id?: string; section_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id);
    const sql = await getSql();
    const id = data.id || uid("dwid");
    if (data.id) {
      await sql`
        update db_dash_widgets set
          label = ${data.label ?? ""},
          display = ${data.display ?? "text"},
          icon = ${data.icon ?? "link"},
          image_url = ${data.image_url ?? null},
          show_clicks = ${data.show_clicks ?? true},
          show_last_click = ${data.show_last_click ?? false},
          click_mode = ${data.click_mode ?? "copy"},
          x = ${data.x ?? 0}, y = ${data.y ?? 0},
          w = ${data.w ?? 2}, h = ${data.h ?? 2},
          group_id = ${data.group_id ?? null}
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into db_dash_widgets (
          id, section_id, short_id, resource_id, label, display, icon, image_url,
          show_clicks, show_last_click, click_mode, x, y, w, h, created_by
        ) values (
          ${id}, ${data.section_id}, ${data.short_id ?? null}, ${data.resource_id ?? null},
          ${data.label ?? ""}, ${data.display ?? "text"}, ${data.icon ?? "link"},
          ${data.image_url ?? null}, ${data.show_clicks ?? true}, ${data.show_last_click ?? false},
          ${data.click_mode ?? "copy"},
          ${data.x ?? 0}, ${data.y ?? 0}, ${data.w ?? 2}, ${data.h ?? 2}, ${context.userId}
        )
      `;
    }
    return loadDashState(mem.tenant.id, context.userId, undefined, mem.tenant.dash_user_buttons);
  });

export const deleteDashWidget = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id);
    const sql = await getSql();
    await sql`delete from db_dash_widgets where id = ${data.id}`;
    return loadDashState(mem.tenant.id, context.userId, undefined, mem.tenant.dash_user_buttons);
  });

export const saveDashGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      tenant_id?: string;
      id?: string;
      section_id: string;
      title?: string;
      color?: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update db_dash_groups set
          title = ${data.title ?? ""}, color = ${data.color ?? "#64748b"},
          x = ${data.x}, y = ${data.y}, w = ${data.w}, h = ${data.h}
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into db_dash_groups (id, section_id, title, color, x, y, w, h)
        values (${uid("dgrp")}, ${data.section_id}, ${data.title ?? ""}, ${data.color ?? "#64748b"},
          ${data.x}, ${data.y}, ${data.w}, ${data.h})
      `;
    }
    return loadDashState(mem.tenant.id, context.userId, undefined, mem.tenant.dash_user_buttons);
  });

export const deleteDashGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { id: string; tenant_id?: string }) => d)
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id);
    const sql = await getSql();
    await sql`delete from db_dash_groups where id = ${data.id}`;
    return loadDashState(mem.tenant.id, context.userId, undefined, mem.tenant.dash_user_buttons);
  });

export const pinShortDash = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (d: {
      tenant_id?: string;
      short_id: string;
      label: string;
      display?: DashWidget["display"];
      image?: string | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id);
    await pinShortToDash({
      tenantId: mem.tenant.id,
      userId: context.userId,
      shortId: data.short_id,
      label: data.label,
      display: data.display,
      image: data.image,
    });
    return loadDashState(mem.tenant.id, context.userId, undefined, mem.tenant.dash_user_buttons);
  });

export const addDashTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; team_id: string; user_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id, data.team_id);
    if (mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    await sql`
      insert into db_team_members (id, team_id, user_id, role)
      values (${uid("tmem")}, ${data.team_id}, ${data.user_id}, ${"member"})
      on conflict (team_id, user_id) do nothing
    `;
    return loadDashState(mem.tenant.id, context.userId, data.team_id, mem.tenant.dash_user_buttons);
  });

export const removeDashTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: { tenant_id?: string; team_id: string; user_id: string }) => d)
  .handler(async ({ context, data }) => {
    const { mem } = await dashOf(context.userId, data.tenant_id, data.team_id);
    if (mem.member.role === "member") throw new Error("Keine Berechtigung");
    const sql = await getSql();
    await sql`delete from db_team_members where team_id = ${data.team_id} and user_id = ${data.user_id}`;
    return loadDashState(mem.tenant.id, context.userId, data.team_id, mem.tenant.dash_user_buttons);
  });

export type { DashState };
