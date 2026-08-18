import { promises as dns } from "node:dns";
import { Resolver } from "node:dns";
import { CNAME_TARGET, PLATFORM_LINK_HOST } from "./brand";

function norm(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

const ACCEPT = new Set([
  norm(CNAME_TARGET),
  PLATFORM_LINK_HOST,
  `www.${PLATFORM_LINK_HOST}`,
  "cname.vercel-dns.com",
]);

function accepted(name: string): boolean {
  const n = norm(name);
  if (ACCEPT.has(n)) return true;
  if (n.endsWith(".vercel-dns.com")) return true;
  if (/\.vercel-dns-\d+\.com$/.test(n)) return true;
  if (n.endsWith(`.${PLATFORM_LINK_HOST}`)) return true;
  return false;
}

async function cnamesOf(host: string): Promise<string[]> {
  const a = await dns.resolveCname(host).catch(() => [] as string[]);
  if (a.length) return a;
  try {
    const r = new Resolver();
    r.setServers(["1.1.1.1", "8.8.8.8"]);
    return await new Promise<string[]>((resolve) => {
      r.resolveCname(host, (err, list) => resolve(err || !list ? [] : list));
    });
  } catch {
    return [];
  }
}

async function aOf(host: string): Promise<string[]> {
  const a = await dns.resolve4(host).catch(() => [] as string[]);
  if (a.length) return a;
  try {
    const r = new Resolver();
    r.setServers(["1.1.1.1", "8.8.8.8"]);
    return await new Promise<string[]>((resolve) => {
      r.resolve4(host, (err, list) => resolve(err || !list ? [] : list));
    });
  } catch {
    return [];
  }
}

export async function probeDomainDns(
  host: string,
): Promise<{ ok: boolean; detail: string }> {
  const h = norm(host);
  if (!h.includes(".")) return { ok: false, detail: "Ungültiger Host" };

  try {
    const first = (await cnamesOf(h))[0];
    let hop = first ? norm(first) : "";
    for (let i = 0; i < 5 && hop; i++) {
      if (accepted(hop)) {
        return { ok: true, detail: `CNAME → ${hop}` };
      }
      const next = await cnamesOf(hop);
      hop = next[0] ? norm(next[0]) : "";
    }

    const ours = [
      ...(await aOf(CNAME_TARGET)),
      ...(await aOf(PLATFORM_LINK_HOST)),
      ...(await aOf(`www.${PLATFORM_LINK_HOST}`)),
    ];
    const theirs = await aOf(h);
    const overlap = theirs.find((ip) => ours.includes(ip));
    if (overlap) return { ok: true, detail: `A → ${overlap}` };
  } catch {
    /* fall through to HTTPS */
  }

  try {
    const res = await fetch(`https://${h}/`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(3500),
      headers: { "user-agent": "bestl.ink-dns-check" },
    });
    const text = await res.text();
    if (res.ok && /bestl\.ink/i.test(text)) {
      return { ok: true, detail: "HTTPS zeigt auf bestl.ink" };
    }
  } catch {
    /* pending */
  }

  return { ok: false, detail: "DNS zeigt noch nicht auf bestl.ink" };
}
