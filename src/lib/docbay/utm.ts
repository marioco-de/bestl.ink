export type UtmRow = { id: string; key: string; value: string };

export const UTM_STD: { key: string; labelKey: string }[] = [
  { key: "utm_campaign", labelKey: "short.utmCampaign" },
  { key: "utm_source", labelKey: "short.utmSource" },
  { key: "utm_medium", labelKey: "short.utmMedium" },
  { key: "utm_term", labelKey: "short.utmTerm" },
  { key: "utm_content", labelKey: "short.utmContent" },
  { key: "utm_id", labelKey: "short.utmId" },
];

const COLS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);

function rid() {
  return Math.random().toString(36).slice(2, 9);
}

export function emptyUtmRows(): UtmRow[] {
  return UTM_STD.map((k) => ({ id: rid(), key: k.key, value: "" }));
}

export function unpackUtm(input: {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  utm_extra?: Record<string, string> | string | null;
}): UtmRow[] {
  const extra =
    typeof input.utm_extra === "string"
      ? safeObj(input.utm_extra)
      : input.utm_extra || {};
  const map: Record<string, string> = {
    utm_campaign: input.utm_campaign || "",
    utm_source: input.utm_source || "",
    utm_medium: input.utm_medium || "",
    utm_term: input.utm_term || "",
    utm_content: input.utm_content || "",
    ...extra,
  };
  const rows = emptyUtmRows().map((r) => ({ ...r, value: map[r.key] || "" }));
  for (const [key, value] of Object.entries(map)) {
    if (rows.some((r) => r.key === key) || !value) continue;
    rows.push({ id: rid(), key, value });
  }
  return rows;
}

export function packUtm(rows: UtmRow[]): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_extra: Record<string, string>;
} {
  const extra: Record<string, string> = {};
  const out: Record<string, string> = {};
  for (const r of rows) {
    const key = normalizeUtmKey(r.key);
    const value = r.value.trim();
    if (!key || !value) continue;
    if (COLS.has(key)) out[key] = value;
    else extra[key] = value;
  }
  return {
    utm_source: out.utm_source,
    utm_medium: out.utm_medium,
    utm_campaign: out.utm_campaign,
    utm_term: out.utm_term,
    utm_content: out.utm_content,
    utm_extra: extra,
  };
}

export function utmActive(rows: UtmRow[]): boolean {
  return rows.some((r) => r.value.trim());
}

export function normalizeUtmKey(raw: string): string {
  const k = raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!k) return "";
  return k.startsWith("utm_") ? k : `utm_${k}`;
}

export function applyUtmParams(
  url: string,
  params: Record<string, string | null | undefined>,
): string {
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) {
      if (v) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function safeObj(raw: string): Record<string, string> {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    return Object.fromEntries(
      Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
    );
  } catch {
    return {};
  }
}
