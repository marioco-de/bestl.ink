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
  const headers = records[0]!.map((h) => h.trim().toLowerCase().replace(/^\ufeff/, ""));
  const rows: Record<string, string>[] = [];
  for (const rec of records.slice(1)) {
    if (rec.every((c) => !c.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (rec[i] ?? "").trim();
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

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v) return v;
  }
  return "";
}

export type CsvShortRow = {
  destination: string;
  slug?: string;
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
};

export function csvRowToShort(row: Record<string, string>): CsvShortRow | null {
  let dest = pick(row, ["destination", "url", "target", "long_url", "dest", "link"]);
  if (!dest) return null;
  dest = dest.trim();
  if (!/^https?:\/\//i.test(dest)) dest = `https://${dest}`;
  const tagsRaw = pick(row, ["tags", "tag"]);
  const tags = tagsRaw
    ? tagsRaw
        .split(/[,|]/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const cloakRaw = pick(row, ["cloak"]).toLowerCase();
  return {
    destination: dest,
    slug: pick(row, ["slug", "short", "key", "code", "path"]) || undefined,
    title: pick(row, ["title", "name"]) || undefined,
    note: pick(row, ["note", "notes", "comment"]) || undefined,
    tags,
    utm_source: pick(row, ["utm_source", "source"]) || undefined,
    utm_medium: pick(row, ["utm_medium", "medium"]) || undefined,
    utm_campaign: pick(row, ["utm_campaign", "campaign"]) || undefined,
    utm_term: pick(row, ["utm_term", "term"]) || undefined,
    utm_content: pick(row, ["utm_content", "content"]) || undefined,
    ios_url: pick(row, ["ios_url", "ios"]) || undefined,
    android_url: pick(row, ["android_url", "android"]) || undefined,
    cloak: cloakRaw === "1" || cloakRaw === "true" || cloakRaw === "yes" || cloakRaw === "ja",
    expires_at: pick(row, ["expires_at", "expires", "expiry"]) || undefined,
  };
}
