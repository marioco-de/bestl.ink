import type { FeatureKey, FeatureMap } from "./types";
import { FEATURE_KEYS } from "./types";
import { defaultFeatures } from "./features";

export type PlanKind = "appsumo" | "monthly" | "custom";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  kind: PlanKind;
  description: string;
  features: FeatureMap;
  created_at: string;
}

export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
  appsumo: "AppSumo",
  monthly: "Monatlich",
  custom: "Custom",
};

export function emptyFeatureMap(): FeatureMap {
  const m = {} as FeatureMap;
  for (const k of FEATURE_KEYS) m[k] = false;
  return m;
}

export function parsePlanFeatures(raw: unknown): FeatureMap {
  const m = emptyFeatureMap();
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
  for (const k of FEATURE_KEYS) {
    if (k in obj) m[k] = Boolean(obj[k]);
  }
  return m;
}

function pick(
  keys: FeatureKey[],
  extra: Partial<FeatureMap> = {},
): FeatureMap {
  const m = emptyFeatureMap();
  for (const k of keys) m[k] = true;
  return { ...m, ...extra };
}

const CORE: FeatureKey[] = [
  "chat",
  "pdf_analytics",
  "page_proxy",
  "download_control",
  "brand_custom",
  "notifications",
  "short_links",
  "qr_codes",
  "unbranded_redirect",
];

const GROWTH: FeatureKey[] = [
  ...CORE,
  "watermarks",
  "nda",
  "password_links",
  "one_time_links",
  "team_goals",
  "bulk_links",
  "link_share_detect",
  "targeting",
  "og_previews",
];

const PRO: FeatureKey[] = [
  ...GROWTH,
  "webhooks",
  "smtp_email",
  "emailit_custom",
  "public_api",
  "splash_logo",
];

const ELITE: FeatureKey[] = [
  ...PRO,
  "hide_brand_flag",
  "emailit_platform",
];

/** Seed catalog — applied once when no plans exist. */
export function defaultPlanCatalog(): Omit<Plan, "id" | "created_at">[] {
  return [
    {
      name: "AppSumo Tier 1",
      slug: "appsumo-tier-1",
      kind: "appsumo",
      description: "Lifetime · Kern-Features für einzelne Seller",
      features: pick(CORE),
    },
    {
      name: "AppSumo Tier 2",
      slug: "appsumo-tier-2",
      kind: "appsumo",
      description: "Lifetime · Team, NDA, Bulk-Links",
      features: pick(GROWTH),
    },
    {
      name: "AppSumo Tier 3",
      slug: "appsumo-tier-3",
      kind: "appsumo",
      description: "Lifetime · alles außer Platform-Emailit",
      features: pick(PRO),
    },
    {
      name: "Starter",
      slug: "starter-monthly",
      kind: "monthly",
      description: "Monatlich · Einstieg",
      features: pick(CORE),
    },
    {
      name: "Pro",
      slug: "pro-monthly",
      kind: "monthly",
      description: "Monatlich · Sales-Teams, Logo auf dem Splash",
      features: pick(PRO),
    },
    {
      name: "Elite",
      slug: "elite-monthly",
      kind: "monthly",
      description: "Monatlich · White-Label: BESTL.INK-Hinweis ausblendbar",
      features: pick(ELITE),
    },
    {
      name: "Business",
      slug: "business-monthly",
      kind: "monthly",
      description: "Monatlich · alle Features inkl. Platform-Emailit",
      features: { ...defaultFeatures(), emailit_platform: true, splash_logo: true, hide_brand_flag: true, unbranded_redirect: true },
    },
  ];
}
