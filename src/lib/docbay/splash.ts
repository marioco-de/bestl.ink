export type SplashMode = "branded" | "off" | "page";

export type SplashLink = {
  id: string;
  label: string;
  url: string;
};

export type SplashSettings = {
  mode: SplashMode;
  hide_flag: boolean;
  cta_x: number;
  cta_y: number;
  links: SplashLink[];
};

export const DEFAULT_SPLASH: SplashSettings = {
  mode: "branded",
  hide_flag: false,
  cta_x: 50,
  cta_y: 78,
  links: [],
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function parseSplash(raw: unknown): SplashSettings {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }
  const mode = obj.mode === "off" || obj.mode === "page" ? obj.mode : "branded";
  const linksRaw = Array.isArray(obj.links) ? obj.links : [];
  const links: SplashLink[] = [];
  for (const item of linksRaw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { id?: unknown; label?: unknown; url?: unknown };
    const url = String(rec.url || "").trim();
    if (!url) continue;
    links.push({
      id: String(rec.id || `l${links.length}`),
      label: String(rec.label || url).trim().slice(0, 80),
      url: url.slice(0, 2000),
    });
    if (links.length >= 12) break;
  }
  return {
    mode,
    hide_flag: Boolean(obj.hide_flag),
    cta_x: clamp(Number(obj.cta_x ?? DEFAULT_SPLASH.cta_x), 8, 92),
    cta_y: clamp(Number(obj.cta_y ?? DEFAULT_SPLASH.cta_y), 10, 92),
    links,
  };
}

export function publicSplash(
  settings: SplashSettings,
  features: {
    unbranded_redirect?: boolean;
    brand_custom?: boolean;
    splash_logo?: boolean;
    hide_brand_flag?: boolean;
  },
  logoUrl: string | null,
): {
  mode: SplashMode;
  hide_flag: boolean;
  cta_x: number;
  cta_y: number;
  links: SplashLink[];
  logo_url: string | null;
} {
  const canOff = Boolean(features.unbranded_redirect);
  const canPage = Boolean(features.brand_custom);
  let mode: SplashMode = "branded";
  if (settings.mode === "off" && canOff) mode = "off";
  else if (settings.mode === "page" && canPage) mode = "page";
  else if (settings.mode === "branded" && canPage) mode = "branded";
  else if (settings.mode === "off" && !canOff) mode = "branded";
  return {
    mode,
    hide_flag: Boolean(features.hide_brand_flag && settings.hide_flag),
    cta_x: canPage ? settings.cta_x : DEFAULT_SPLASH.cta_x,
    cta_y: canPage ? settings.cta_y : DEFAULT_SPLASH.cta_y,
    links: canPage ? settings.links : [],
    logo_url: features.splash_logo ? logoUrl : null,
  };
}
