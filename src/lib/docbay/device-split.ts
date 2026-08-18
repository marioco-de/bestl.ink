export type SplitKind = "os" | "browser" | "device" | "country";

export type SplitRule = {
  id: string;
  kind: SplitKind;
  match: string;
  url: string;
};

export const SPLIT_TARGETS: { key: string; kind: SplitKind; match: string; label: string }[] = [
  { key: "os:iOS", kind: "os", match: "iOS", label: "iOS" },
  { key: "os:Android", kind: "os", match: "Android", label: "Android" },
  { key: "os:macOS", kind: "os", match: "macOS", label: "macOS" },
  { key: "os:Windows", kind: "os", match: "Windows", label: "Windows" },
  { key: "os:Linux", kind: "os", match: "Linux", label: "Linux" },
  { key: "browser:Safari", kind: "browser", match: "Safari", label: "Safari" },
  { key: "browser:Chrome", kind: "browser", match: "Chrome", label: "Chrome" },
  { key: "browser:Firefox", kind: "browser", match: "Firefox", label: "Firefox" },
  { key: "browser:Edge", kind: "browser", match: "Edge", label: "Edge" },
  { key: "browser:Mobile Safari", kind: "browser", match: "Mobile Safari", label: "Mobile Safari" },
  { key: "browser:Mobile Chrome", kind: "browser", match: "Mobile Chrome", label: "Mobile Chrome" },
  { key: "device:mobile", kind: "device", match: "mobile", label: "Mobile" },
  { key: "device:tablet", kind: "device", match: "tablet", label: "Tablet" },
  { key: "device:desktop", kind: "device", match: "desktop", label: "Desktop" },
  { key: "country", kind: "country", match: "", label: "Land" },
];

export const SPLIT_COUNTRIES = [
  "DE", "AT", "CH", "FR", "IT", "ES", "NL", "BE", "PL", "CZ",
  "GB", "IE", "US", "CA", "AU", "DK", "SE", "NO", "FI", "PT",
] as const;

export function emptySplitRule(): SplitRule {
  return { id: Math.random().toString(36).slice(2, 9), kind: "os", match: "iOS", url: "" };
}

export function targetKey(rule: SplitRule): string {
  return rule.kind === "country" ? "country" : `${rule.kind}:${rule.match}`;
}

export function applyTarget(rule: SplitRule, key: string): SplitRule {
  const t = SPLIT_TARGETS.find((x) => x.key === key);
  if (!t) return rule;
  if (t.kind === "country") {
    return { ...rule, kind: "country", match: rule.kind === "country" && rule.match ? rule.match : "DE" };
  }
  return { ...rule, kind: t.kind, match: t.match };
}

export function packSplitRules(rules: SplitRule[]): {
  ios_url?: string;
  android_url?: string;
  geo_rules: Record<string, string>;
} {
  const geo_rules: Record<string, string> = {};
  let ios_url: string | undefined;
  let android_url: string | undefined;
  for (const r of rules) {
    const url = r.url.trim();
    if (!url || !r.match) continue;
    if (r.kind === "os" && r.match === "iOS") ios_url = url;
    if (r.kind === "os" && r.match === "Android") android_url = url;
    const key = r.kind === "country" ? r.match.toUpperCase() : `${r.kind}:${r.match}`;
    geo_rules[key] = url;
  }
  return { ios_url, android_url, geo_rules };
}

export function unpackSplitRules(input: {
  ios_url?: string | null;
  android_url?: string | null;
  geo_rules?: Record<string, string> | null;
}): SplitRule[] {
  const seen = new Set<string>();
  const out: SplitRule[] = [];
  const add = (kind: SplitKind, match: string, url: string) => {
    const key = `${kind}:${match}`;
    if (!url || seen.has(key)) return;
    seen.add(key);
    out.push({ id: Math.random().toString(36).slice(2, 9), kind, match, url });
  };
  add("os", "iOS", input.ios_url || "");
  add("os", "Android", input.android_url || "");
  for (const [raw, url] of Object.entries(input.geo_rules || {})) {
    if (raw.startsWith("os:")) add("os", raw.slice(3), url);
    else if (raw.startsWith("browser:")) add("browser", raw.slice(8), url);
    else if (raw.startsWith("device:")) add("device", raw.slice(7), url);
    else if (raw.startsWith("country:")) add("country", raw.slice(8).toUpperCase(), url);
    else add("country", raw.toUpperCase(), url);
  }
  return out.length ? out : [emptySplitRule()];
}

export function splitRuleMatches(
  rule: SplitRule,
  parsed: { device: string; os: string; browser: string },
  country: string,
): boolean {
  const url = rule.url.trim();
  if (!url || !rule.match) return false;
  if (rule.kind === "os") return parsed.os === rule.match;
  if (rule.kind === "device") return parsed.device === rule.match;
  if (rule.kind === "country") return country.toUpperCase() === rule.match.toUpperCase();
  if (rule.kind === "browser") {
    const mobile = parsed.device !== "desktop";
    if (rule.match === "Mobile Safari") return parsed.browser === "Safari" && mobile;
    if (rule.match === "Mobile Chrome") return parsed.browser === "Chrome" && mobile;
    return parsed.browser === rule.match;
  }
  return false;
}
