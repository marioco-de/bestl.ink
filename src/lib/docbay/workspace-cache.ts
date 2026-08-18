import { PLATFORM_LINK_HOST } from "./brand";
import { defaultFeatures } from "./features";
import { emptyDash } from "./dashboard";
import type { FullState, WorkspaceSummary } from "./types";

const PREFIX = "bestl.ws.";
const mem = new Map<string, FullState>();

function storage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function cacheWorkspace(state: FullState): void {
  if (!state?.tenant?.id || state.tenant.id === "platform") return;
  mem.set(state.tenant.id, state);
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PREFIX + state.tenant.id, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function readWorkspaceCache(id: string): FullState | null {
  if (!id) return null;
  const hit = mem.get(id);
  if (hit) return hit;
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FullState;
    if (!parsed?.tenant?.id) return null;
    mem.set(id, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function workspaceShell(
  ws: WorkspaceSummary,
  from: FullState,
): FullState {
  const host = `${ws.subdomain}.${PLATFORM_LINK_HOST}`;
  return {
    ...from,
    tenant: {
      ...from.tenant,
      id: ws.id,
      name: ws.name,
      slug: ws.subdomain,
      subdomain: ws.subdomain,
      domain: host,
      custom_domain: "",
      custom_domain_connected: false,
      public_host: host,
      brand_company: ws.name,
    },
    member: {
      ...from.member,
      tenant_id: ws.id,
      role: ws.role,
      param_button_id: null,
    },
    features: defaultFeatures(),
    resources: [],
    params: [],
    tags: [],
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
    workspaces: from.workspaces,
    isSuperAdmin: from.isSuperAdmin,
    platformTenants: from.platformTenants,
  };
}
