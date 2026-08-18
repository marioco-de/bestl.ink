import { CNAME_TARGET, PLATFORM_LINK_HOST } from "./brand";

export type VercelDomainResult = {
  ok: boolean;
  configured: boolean;
  verified: boolean;
  detail: string;
};

function creds() {
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

export function vercelDomainsReady(): boolean {
  const { token, project } = creds();
  return Boolean(token && project);
}

async function vercelFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const { token, team } = creds();
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

export async function ensureVercelDomain(
  host: string,
): Promise<VercelDomainResult> {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  if (!h.includes(".")) {
    return { ok: false, configured: false, verified: false, detail: "Ungültiger Host" };
  }
  if (!vercelDomainsReady()) {
    return {
      ok: false,
      configured: false,
      verified: false,
      detail: "VERCEL_TOKEN / VERCEL_PROJECT_ID fehlen",
    };
  }
  const { project } = creds();

  const existing = await vercelFetch(`/v9/projects/${project}/domains/${h}`);
  if (existing.status === 200) {
    const verified = Boolean(existing.json.verified);
    if (!verified) {
      await vercelFetch(`/v9/projects/${project}/domains/${h}/verify`, {
        method: "POST",
      });
    }
    return {
      ok: true,
      configured: true,
      verified,
      detail: verified ? "Bei Vercel aktiv" : "Bei Vercel, SSL ausstehend",
    };
  }

  const created = await vercelFetch(`/v10/projects/${project}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: h }),
  });
  if (created.status === 200 || created.status === 201) {
    const verified = Boolean(created.json.verified);
    if (!verified) {
      await vercelFetch(`/v9/projects/${project}/domains/${h}/verify`, {
        method: "POST",
      });
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
  if (!vercelDomainsReady()) return;
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  const { project } = creds();
  await vercelFetch(`/v9/projects/${project}/domains/${h}`, { method: "DELETE" }).catch(
    () => undefined,
  );
}

let platformOnce: Promise<void> | null = null;

export function ensurePlatformVercelDomains(): Promise<void> {
  if (!platformOnce) {
    platformOnce = (async () => {
      if (!vercelDomainsReady()) return;
      await ensureVercelDomain(CNAME_TARGET);
      await ensureVercelDomain(PLATFORM_LINK_HOST);
      await ensureVercelDomain(`www.${PLATFORM_LINK_HOST}`);
    })().catch(() => undefined);
  }
  return platformOnce;
}
