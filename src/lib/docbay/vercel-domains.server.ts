import { CNAME_TARGET, PLATFORM_LINK_HOST } from "./brand";

export type VercelDomainResult = {
  ok: boolean;
  configured: boolean;
  verified: boolean;
  detail: string;
};

type Creds = { token: string; project: string; team: string };

function envCreds(): Partial<Creds> {
  const token = (
    process.env.VERCEL_TOKEN ||
    process.env.VERCEL_ACCESS_TOKEN ||
    ""
  ).trim();
  const project = (process.env.VERCEL_PROJECT_ID || "").trim();
  const team = (
    process.env.VERCEL_TEAM_ID ||
    process.env.VERCEL_ORG_ID ||
    ""
  ).trim();
  return { token, project, team };
}

let resolved: Creds | null = null;
let resolveOnce: Promise<Creds | null> | null = null;

export function vercelDomainsReady(): boolean {
  const e = envCreds();
  return Boolean(e.token && (e.project || true));
}

async function vercelFetch(
  path: string,
  init: RequestInit = {},
  cred?: Partial<Creds>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const token = cred?.token || envCreds().token || "";
  const team = cred?.team || envCreds().team || "";
  const url = new URL(`https://api.vercel.com${path}`);
  if (team) url.searchParams.set("teamId", team);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(8000),
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

function pickProject(
  projects: Record<string, unknown>[],
): Record<string, unknown> | undefined {
  const byDomain = projects.find((p) => {
    const aliases = [
      ...((p.alias as string[]) || []),
      ...((p.targets as { production?: { alias?: string[] } })?.production?.alias ||
        []),
    ]
      .join(" ")
      .toLowerCase();
    const name = String(p.name || "").toLowerCase();
    return (
      aliases.includes(PLATFORM_LINK_HOST) ||
      name === "bestl-ink" ||
      name === "bestl.ink" ||
      name.includes("bestl")
    );
  });
  return byDomain || projects[0];
}

async function discoverCreds(): Promise<Creds | null> {
  const e = envCreds();
  if (!e.token) return null;
  if (e.project) {
    return { token: e.token, project: e.project, team: e.team || "" };
  }

  const user = await vercelFetch("/v2/user", {}, { token: e.token });
  const defaultTeam =
    e.team ||
    String(
      (user.json.user as { defaultTeamId?: string } | undefined)?.defaultTeamId ||
        "",
    );

  const teams = await vercelFetch("/v2/teams", {}, { token: e.token, team: "" });
  const teamList = ((teams.json.teams as { id?: string }[]) || []).map((t) =>
    String(t.id || ""),
  );
  const teamIds = [defaultTeam, ...teamList, ""].filter(
    (id, i, a) => a.indexOf(id) === i,
  );

  for (const team of teamIds) {
    const list = await vercelFetch(
      "/v9/projects?limit=100",
      {},
      { token: e.token, team },
    );
    const projects = (list.json.projects as Record<string, unknown>[]) || [];
    const hit = pickProject(projects);
    if (hit?.id) {
      return { token: e.token, project: String(hit.id), team };
    }
  }
  return e.token ? { token: e.token, project: "", team: defaultTeam } : null;
}

async function getCreds(): Promise<Creds | null> {
  if (resolved?.project) return resolved;
  if (!resolveOnce) {
    resolveOnce = discoverCreds()
      .then((c) => {
        resolved = c;
        return c;
      })
      .catch(() => null);
  }
  return resolveOnce;
}

export async function vercelDomainsConfigured(): Promise<boolean> {
  const c = await getCreds();
  return Boolean(c?.token && c.project);
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
    return {
      ok: false,
      configured: false,
      verified: false,
      detail: "VERCEL_TOKEN fehlt",
    };
  }
  if (!cred.project) {
    return {
      ok: false,
      configured: false,
      verified: false,
      detail: "Vercel-Projekt nicht gefunden — Token prüfen",
    };
  }

  const existing = await vercelFetch(
    `/v9/projects/${cred.project}/domains/${h}`,
    {},
    cred,
  );
  if (existing.status === 200) {
    const verified = Boolean(existing.json.verified);
    if (!verified) {
      await vercelFetch(
        `/v9/projects/${cred.project}/domains/${h}/verify`,
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
        `/v9/projects/${cred.project}/domains/${h}/verify`,
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
    return {
      ok: true,
      configured: true,
      verified: true,
      detail: "Domain war schon im Projekt",
    };
  }
  return {
    ok: false,
    configured: true,
    verified: false,
    detail: errText(created.json, `Vercel ${created.status}`),
  };
}

export async function removeVercelDomain(host: string): Promise<void> {
  const cred = await getCreds();
  if (!cred?.project) return;
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  await vercelFetch(
    `/v9/projects/${cred.project}/domains/${h}`,
    { method: "DELETE" },
    cred,
  ).catch(() => undefined);
}

let platformOnce: Promise<void> | null = null;

export function ensurePlatformVercelDomains(): Promise<void> {
  if (!platformOnce) {
    platformOnce = (async () => {
      const cred = await getCreds();
      if (!cred?.project) return;
      await ensureVercelDomain(CNAME_TARGET);
      await ensureVercelDomain(PLATFORM_LINK_HOST);
      await ensureVercelDomain(`www.${PLATFORM_LINK_HOST}`);
    })().catch(() => undefined);
  }
  return platformOnce;
}
