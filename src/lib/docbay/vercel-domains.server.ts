import { CNAME_TARGET, PLATFORM_LINK_HOST } from "./brand";
import { getSetting, setSetting } from "./settings.server";

export type VercelDomainResult = {
  ok: boolean;
  configured: boolean;
  verified: boolean;
  detail: string;
};

export type VercelSetup = {
  ready: boolean;
  token: boolean;
  project: string;
  team: string;
  cname: string;
  lastError: string;
  registered: { host: string; ok: boolean; detail: string }[];
};

type Creds = { token: string; project: string; team: string };

let resolved: Creds | null = null;
let lastError = "";

async function envAndDbCreds(): Promise<Partial<Creds>> {
  const token = (
    process.env.VERCEL_TOKEN ||
    process.env.VERCEL_ACCESS_TOKEN ||
    (await getSetting("vercel_token")) ||
    ""
  ).trim();
  const project = (
    process.env.VERCEL_PROJECT_ID ||
    (await getSetting("vercel_project_id")) ||
    ""
  ).trim();
  const team = (
    process.env.VERCEL_TEAM_ID ||
    process.env.VERCEL_ORG_ID ||
    (await getSetting("vercel_team_id")) ||
    ""
  ).trim();
  return { token, project, team };
}

async function vercelFetch(
  path: string,
  init: RequestInit = {},
  cred?: Partial<Creds>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const token = cred?.token || "";
  const team = cred?.team || "";
  const url = new URL(`https://api.vercel.com${path}`);
  if (team) url.searchParams.set("teamId", team);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(12000),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

function errText(json: Record<string, unknown>, fallback: string): string {
  const err = json.error as { message?: string; code?: string } | undefined;
  return err?.message || err?.code || fallback;
}

async function persistCreds(c: Creds): Promise<void> {
  if (c.project) await setSetting("vercel_project_id", c.project);
  if (c.team) await setSetting("vercel_team_id", c.team);
}

async function discoverCreds(): Promise<Creds | null> {
  const e = await envAndDbCreds();
  if (!e.token) {
    lastError = "VERCEL_TOKEN fehlt — unter Domains einmal eintragen";
    return null;
  }
  if (e.project) {
    return { token: e.token, project: e.project, team: e.team || "" };
  }

  const user = await vercelFetch("/v2/user", {}, { token: e.token, team: "" });
  if (user.status >= 400) {
    lastError = errText(user.json, `Token ungültig (${user.status})`);
    return null;
  }
  const defaultTeam = String(
    (user.json.user as { defaultTeamId?: string } | undefined)?.defaultTeamId ||
      e.team ||
      "",
  );

  const teamsRes = await vercelFetch("/v2/teams?limit=20", {}, { token: e.token, team: "" });
  const teamIds = [
    defaultTeam,
    ...(((teamsRes.json.teams as { id?: string }[]) || []).map((t) => String(t.id || ""))),
    "",
  ].filter((id, i, a) => a.indexOf(id) === i);

  for (const team of teamIds) {
    const domains = await vercelFetch("/v5/domains?limit=100", {}, { token: e.token, team });
    const list = (domains.json.domains as { name?: string; projectId?: string }[]) || [];
    const hit = list.find((d) => {
      const n = String(d.name || "").toLowerCase();
      return (
        n === PLATFORM_LINK_HOST ||
        n === `www.${PLATFORM_LINK_HOST}` ||
        n === CNAME_TARGET ||
        n.endsWith(`.${PLATFORM_LINK_HOST}`)
      );
    });
    if (hit?.projectId) {
      lastError = "";
      const cred = { token: e.token, project: String(hit.projectId), team };
      await persistCreds(cred);
      return cred;
    }

    const projects = await vercelFetch(
      "/v9/projects?limit=100",
      {},
      { token: e.token, team },
    );
    const rows = (projects.json.projects as Record<string, unknown>[]) || [];
    const proj =
      rows.find((p) => {
        const name = String(p.name || "").toLowerCase();
        const link = String((p.link as { repo?: string })?.repo || "").toLowerCase();
        return (
          name.includes("bestl") ||
          name.includes("docbay") ||
          link.includes("bestl") ||
          name.includes("ltis")
        );
      }) || rows[0];
    if (proj?.id) {
      lastError = "";
      const cred = { token: e.token, project: String(proj.id), team };
      await persistCreds(cred);
      return cred;
    }
  }

  lastError = "Kein Vercel-Projekt gefunden — Token-Team prüfen";
  return { token: e.token, project: "", team: defaultTeam };
}

async function getCreds(): Promise<Creds | null> {
  if (resolved?.project) return resolved;
  const c = await discoverCreds();
  if (c?.project) resolved = c;
  return c;
}

export function resetVercelCredCache(): void {
  resolved = null;
  lastError = "";
}

export async function saveVercelToken(input: {
  token?: string;
  project?: string;
  team?: string;
}): Promise<void> {
  if (input.token !== undefined) await setSetting("vercel_token", input.token.trim());
  if (input.project !== undefined) await setSetting("vercel_project_id", input.project.trim());
  if (input.team !== undefined) await setSetting("vercel_team_id", input.team.trim());
  resetVercelCredCache();
}

export async function ensureVercelDomain(
  host: string,
): Promise<VercelDomainResult> {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h.includes(".")) {
    return { ok: false, configured: false, verified: false, detail: "Ungültiger Host" };
  }
  const cred = await getCreds();
  if (!cred?.token) {
    return { ok: false, configured: false, verified: false, detail: lastError || "VERCEL_TOKEN fehlt" };
  }
  if (!cred.project) {
    return {
      ok: false,
      configured: false,
      verified: false,
      detail: lastError || "Vercel-Projekt nicht gefunden",
    };
  }

  const existing = await vercelFetch(
    `/v9/projects/${cred.project}/domains/${encodeURIComponent(h)}`,
    {},
    cred,
  );
  if (existing.status === 200) {
    const verified = Boolean(existing.json.verified);
    if (!verified) {
      await vercelFetch(
        `/v9/projects/${cred.project}/domains/${encodeURIComponent(h)}/verify`,
        { method: "POST" },
        cred,
      );
    }
    return {
      ok: true,
      configured: true,
      verified,
      detail: verified ? "Bei Vercel aktiv" : "Bei Vercel, SSL ausstehend",
    };
  }

  const created = await vercelFetch(
    `/v10/projects/${cred.project}/domains`,
    { method: "POST", body: JSON.stringify({ name: h }) },
    cred,
  );
  if (created.status === 200 || created.status === 201) {
    const verified = Boolean(created.json.verified);
    if (!verified) {
      await vercelFetch(
        `/v9/projects/${cred.project}/domains/${encodeURIComponent(h)}/verify`,
        { method: "POST" },
        cred,
      );
    }
    return {
      ok: true,
      configured: true,
      verified,
      detail: verified ? "Bei Vercel angelegt" : "Bei Vercel angelegt, SSL folgt",
    };
  }
  if (created.status === 409) {
    return { ok: true, configured: true, verified: true, detail: "Domain war schon im Projekt" };
  }
  lastError = errText(created.json, `Vercel ${created.status}`);
  return { ok: false, configured: true, verified: false, detail: lastError };
}

export async function removeVercelDomain(host: string): Promise<void> {
  const cred = await getCreds();
  if (!cred?.project) return;
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  await vercelFetch(
    `/v9/projects/${cred.project}/domains/${encodeURIComponent(h)}`,
    { method: "DELETE" },
    cred,
  ).catch(() => undefined);
}

export async function syncVercelDomains(): Promise<VercelSetup> {
  const registered: VercelSetup["registered"] = [];
  const cred = await getCreds();
  const hosts = [CNAME_TARGET, PLATFORM_LINK_HOST, `www.${PLATFORM_LINK_HOST}`];
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql`
      select host from db_tenant_domains
      union
      select custom_domain as host from db_tenants
      where custom_domain is not null and custom_domain <> ''
    `;
    for (const r of rows as { host?: string }[]) {
      const host = String(r.host || "").toLowerCase();
      if (host.includes(".")) hosts.push(host);
    }
  } catch {
    /* db not ready */
  }
  const unique = [...new Set(hosts)];
  for (const host of unique) {
    const res = await ensureVercelDomain(host);
    registered.push({ host, ok: res.ok, detail: res.detail });
  }
  const fail = registered.find((r) => !r.ok);
  if (fail) lastError = `${fail.host}: ${fail.detail}`;
  else lastError = "";
  await setSetting("vercel_last_sync", JSON.stringify({ at: Date.now(), lastError, registered }));
  return {
    ready: Boolean(cred?.project && cred.token),
    token: Boolean(cred?.token || (await envAndDbCreds()).token),
    project: cred?.project || "",
    team: cred?.team || "",
    cname: CNAME_TARGET,
    lastError,
    registered,
  };
}

let syncing: Promise<VercelSetup> | null = null;

export function ensurePlatformVercelDomains(): Promise<void> {
  if (!syncing) {
    syncing = syncVercelDomains().finally(() => {
      syncing = null;
    });
  }
  return syncing.then(() => undefined);
}
