export type VisitRow = {
  is_bot: boolean;
  device: string;
  os: string;
  browser: string;
  country: string;
  referrer: string;
  trigger?: string;
  created_at: string;
};

export type CountRow = { name: string; value: number };

export type AnalyticsEvent = VisitRow;

export type AnalyticsBundle = {
  total: number;
  human: number;
  series: { t: string; v: number }[];
  devices: CountRow[];
  os: CountRow[];
  browsers: CountRow[];
  countries: CountRow[];
  continents: CountRow[];
  referrers: CountRow[];
  links: CountRow[];
  destinations: CountRow[];
  utm: CountRow[];
  triggers: CountRow[];
  events: AnalyticsEvent[];
};

const EU = new Set([
  "DE", "AT", "CH", "FR", "IT", "ES", "NL", "BE", "PL", "SE", "NO", "DK", "FI",
  "IE", "PT", "CZ", "HU", "RO", "GR", "BG", "HR", "SK", "SI", "LT", "LV", "EE",
  "LU", "MT", "CY", "IS", "LI", "GB", "UK", "UA",
]);

export function continentOf(cc: string): string {
  const c = cc.trim().toUpperCase();
  if (!c || c === "—" || c === "-") return "—";
  if (EU.has(c)) return "Europe";
  if (["US", "CA", "MX"].includes(c)) return "North America";
  if (["BR", "AR", "CL", "CO", "PE", "UY"].includes(c)) return "South America";
  if (["CN", "JP", "IN", "KR", "SG", "TH", "VN", "ID", "PH", "MY", "AE", "SA", "IL", "TR", "TW", "HK"].includes(c))
    return "Asia";
  if (["AU", "NZ"].includes(c)) return "Oceania";
  if (["ZA", "NG", "EG", "KE", "MA", "GH", "TZ"].includes(c)) return "Africa";
  return "Other";
}

function countBy(rows: VisitRow[], key: (r: VisitRow) => string): CountRow[] {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r) || "—";
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function hostOf(ref: string): string {
  const v = (ref || "").trim();
  if (!v) return "(direct)";
  try {
    return new URL(v.startsWith("http") ? v : `https://${v}`).host;
  } catch {
    return v.slice(0, 40);
  }
}

export function rangeSince(range: string | undefined): Date | null {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 3600_000);
  if (range === "7d") return new Date(now - 7 * 864e5);
  if (range === "30d") return new Date(now - 30 * 864e5);
  return null;
}

export function buildAnalytics(
  all: VisitRow[],
  opts: {
    range?: string;
    linkName?: string;
    dest?: string;
    utm?: Record<string, string | null | undefined>;
  } = {},
): AnalyticsBundle {
  const since = rangeSince(opts.range);
  const ranged = all.filter((r) => !since || new Date(r.created_at) >= since);
  const rows = ranged.filter((r) => !r.is_bot);
  const hourly = opts.range === "24h";
  const buckets: { t: string; v: number }[] = [];
  if (hourly) {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 3600_000);
      d.setUTCMinutes(0, 0, 0);
      buckets.push({ t: d.toISOString(), v: 0 });
    }
    for (const r of rows) {
      const d = new Date(r.created_at);
      d.setUTCMinutes(0, 0, 0);
      const key = d.toISOString();
      const hit = buckets.find((b) => b.t === key);
      if (hit) hit.v += 1;
    }
  } else {
    const days = opts.range === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      buckets.push({ t: d.toISOString().slice(0, 10), v: 0 });
    }
    for (const r of rows) {
      const key = r.created_at.slice(0, 10);
      const hit = buckets.find((b) => b.t === key);
      if (hit) hit.v += 1;
    }
  }

  const utmEntries = Object.entries(opts.utm || {})
    .filter(([, v]) => v)
    .map(([k, v]) => ({ name: `${k}=${v}`, value: rows.length || 0 }));

  return {
    total: all.filter((r) => !since || new Date(r.created_at) >= since).length,
    human: rows.length,
    series: buckets,
    devices: countBy(rows, (r) => r.device || "—"),
    os: countBy(rows, (r) => r.os || "—"),
    browsers: countBy(rows, (r) => r.browser || "—"),
    countries: countBy(rows, (r) => r.country || "—"),
    continents: countBy(rows, (r) => continentOf(r.country)),
    referrers: countBy(rows, (r) => hostOf(r.referrer)),
    links: opts.linkName ? [{ name: opts.linkName, value: rows.length }] : [],
    destinations: opts.dest ? [{ name: opts.dest, value: rows.length }] : [],
    utm: utmEntries,
    triggers: countBy(rows, (r) => (r.trigger === "qr" ? "QR" : "Link")),
    events: ranged.slice(0, 200),
  };
}
