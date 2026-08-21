export function sniffCsvDelimiter(text: string): "," | ";" {
  const line = (text.split(/\r?\n/).find((l) => l.trim()) || "").trim();
  let comma = 0;
  let semi = 0;
  let q = false;
  for (const ch of line) {
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (q) continue;
    if (ch === ",") comma++;
    if (ch === ";") semi++;
  }
  return semi > comma ? ";" : ",";
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const delim = sniffCsvDelimiter(text);
  const records = splitCsvRecords(text, delim);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0]!.map((h) =>
    h.trim().toLowerCase().replace(/^\ufeff/, "").replace(/\s+/g, " "),
  );
  const cols = headers.length;
  const rows: Record<string, string>[] = [];
  for (const rec of records.slice(1)) {
    if (rec.every((c) => !c.trim())) continue;
    let cells = rec;
    if (cells.length > cols && cols > 0) {
      cells = [...cells.slice(0, cols - 1), cells.slice(cols - 1).join(delim)];
    }
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvRecords(text: string, delim: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const src = text.replace(/^\ufeff/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      q = true;
      continue;
    }
    if (ch === delim) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || (ch === "\r" && src[i + 1] === "\n")) {
      if (ch === "\r") i++;
      row.push(cell);
      cell = "";
      out.push(row);
      row = [];
      continue;
    }
    if (ch === "\r") {
      row.push(cell);
      cell = "";
      out.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>, delim = ","): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/["\r\n]/.test(s) || s.includes(delim)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.map(esc).join(delim), ...rows.map((r) => r.map(esc).join(delim))].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const SHORT_CSV_HEADERS = [
  "destination",
  "slug",
  "title",
  "note",
  "tags",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ios_url",
  "android_url",
  "cloak",
  "expires_at",
  "clicks",
  "created_at",
  "short_url",
] as const;

export const SKIP_DOMAIN_DEFAULT = new Set([
  "foxly.link",
  "bit.ly",
  "dub.sh",
  "dub.co",
  "short.io",
  "rebrand.ly",
  "t.ly",
  "tinyurl.com",
  "ow.ly",
  "cutt.ly",
  "is.gd",
  "rb.gy",
]);

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v) return v;
  }
  return "";
}

function blankish(v: string): string {
  const t = v.trim();
  if (!t || t === "-" || t === "—" || /^none$/i.test(t) || t === ".") return "";
  return t;
}

export function parseShortUrl(raw: string): { host: string; slug: string; href: string } | null {
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const slug = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || "";
    if (!host.includes(".") || !slug) return null;
    return { host, slug, href: url.toString() };
  } catch {
    return null;
  }
}

export type CsvShortRow = {
  destination: string;
  slug?: string;
  host?: string;
  shortUrl?: string;
  title?: string;
  note?: string;
  tags?: string[];
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  ios_url?: string;
  android_url?: string;
  cloak?: boolean;
  expires_at?: string;
  space?: string;
};

export function csvRowToShort(row: Record<string, string>): CsvShortRow | null {
  const shortRaw = pick(row, [
    "short link",
    "short_link",
    "short url",
    "short_url",
    "kurzlink",
    "kürzel",
  ]);
  const parsed = parseShortUrl(shortRaw);
  let dest = blankish(
    pick(row, [
      "original link",
      "original_link",
      "destination",
      "url",
      "target",
      "long_url",
      "long url",
      "dest",
      "ziel",
    ]),
  );
  if (!dest && !parsed) return null;
  if (dest && !/^https?:\/\//i.test(dest)) dest = `https://${dest}`;
  if (!dest) return null;
  const tagsRaw = blankish(pick(row, ["tags", "tag"]));
  const tags = tagsRaw
    ? tagsRaw
        .split(/[,|]/)
        .map((t) => t.trim())
        .filter((t) => t && t !== "-")
    : [];
  const cloakRaw = pick(row, ["cloak"]).toLowerCase();
  const utm = blankish(pick(row, ["utm", "utm_campaign", "campaign"]));
  const utmCampaign = /^(enable|enabled|on|ja)$/i.test(utm) ? "" : utm;
  const note = blankish(pick(row, ["note", "notes", "comment"]));
  const space = blankish(pick(row, ["space", "workspace", "folder"]));
  const slug =
    parsed?.slug ||
    blankish(pick(row, ["slug", "short", "key", "code", "path"])) ||
    undefined;
  return {
    destination: dest,
    slug,
    host: parsed?.host,
    shortUrl: parsed?.href,
    title: blankish(pick(row, ["title", "name"])) || undefined,
    note: note || undefined,
    tags,
    utm_source: blankish(pick(row, ["utm_source", "source"])) || undefined,
    utm_medium: blankish(pick(row, ["utm_medium", "medium"])) || undefined,
    utm_campaign: utmCampaign || blankish(pick(row, ["utm_campaign"])) || undefined,
    utm_term: blankish(pick(row, ["utm_term", "term"])) || undefined,
    utm_content: blankish(pick(row, ["utm_content", "content"])) || undefined,
    ios_url: blankish(pick(row, ["ios_url", "ios"])) || undefined,
    android_url: blankish(pick(row, ["android_url", "android"])) || undefined,
    cloak: cloakRaw === "1" || cloakRaw === "true" || cloakRaw === "yes" || cloakRaw === "ja",
    expires_at: blankish(pick(row, ["expires_at", "expires", "expiry"])) || undefined,
    space: space || undefined,
  };
}

export type CsvDomainGroup = {
  host: string;
  rows: CsvShortRow[];
  spaces: string[];
};

export function groupCsvByDomain(rows: CsvShortRow[]): CsvDomainGroup[] {
  const map = new Map<string, CsvShortRow[]>();
  for (const r of rows) {
    const host = (r.host || "").toLowerCase();
    if (!host) continue;
    const list = map.get(host) ?? [];
    list.push(r);
    map.set(host, list);
  }
  return [...map.entries()]
    .map(([host, list]) => ({
      host,
      rows: list,
      spaces: [...new Set(list.map((r) => r.space).filter((s): s is string => Boolean(s)))],
    }))
    .sort((a, b) => b.rows.length - a.rows.length);
}

export function orphanCsvRows(rows: CsvShortRow[]): CsvShortRow[] {
  return rows.filter((r) => !r.host);
}
