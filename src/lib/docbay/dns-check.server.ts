import { promises as dns } from "node:dns";
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

export async function probeDomainDns(
  host: string,
): Promise<{ ok: boolean; detail: string }> {
  const h = norm(host);
  if (!h.includes(".")) return { ok: false, detail: "Ungültiger Host" };

  try {
    let cnames = await dns.resolveCname(h).catch(() => [] as string[]);
    let hop = cnames[0] ? norm(cnames[0]) : "";
    for (let i = 0; i < 4 && hop; i++) {
      if (accepted(hop)) {
        return { ok: true, detail: `CNAME → ${hop}` };
      }
      const next = await dns.resolveCname(hop).catch(() => [] as string[]);
      hop = next[0] ? norm(next[0]) : "";
    }

    const [ours, theirs] = await Promise.all([
      dns.resolve4(CNAME_TARGET).catch(() =>
        dns.resolve4(`www.${PLATFORM_LINK_HOST}`).catch(() => [] as string[]),
      ),
      dns.resolve4(h).catch(() => [] as string[]),
    ]);
    const overlap = theirs.find((ip) => ours.includes(ip));
    if (overlap) return { ok: true, detail: `A → ${overlap}` };
  } catch {
    /* fall through to HTTPS */
  }

  try {
    const res = await fetch(`https://${h}/`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(2800),
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
