import type { FeatureKey, FeatureMap } from "./types";
import { FEATURE_KEYS } from "./types";

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  emailit_platform: "Platform Emailit (BESTL.INK-Key)",
  emailit_custom: "Eigene Emailit API",
  smtp_email: "SMTP / IMAP-Zugangsdaten",
  chat: "Chat im Dokument",
  pdf_analytics: "PDF Seiten- & Verweildauer",
  watermarks: "Wasserzeichen",
  webhooks: "Webhooks / CRM",
  bulk_links: "Bulk-Links",
  nda: "NDA vor Anzeige",
  password_links: "Zusatz-Passwort",
  one_time_links: "Einmal-Links",
  brand_custom: "Branding",
  page_proxy: "Seiten-Proxy / iFrame",
  notifications: "Klick-Benachrichtigungen",
  team_goals: "Team-Ziele",
  link_share_detect: "Weiterleitungs-Erkennung",
  download_control: "Download an/aus",
  short_links: "Kurzlinks (Shortener)",
  qr_codes: "QR-Codes",
  targeting: "Device- & Geo-Routing",
  og_previews: "OG / Link-Previews",
  public_api: "Public REST API",
  unbranded_redirect: "Redirect ohne BESTL.INK-Fahne",
  splash_logo: "Eigenes Logo auf dem Splash-Screen",
  hide_brand_flag: "BESTL.INK-Hinweis ausblenden (Elite)",
};

/** Defaults for a new paying tenant */
export function defaultFeatures(): FeatureMap {
  const m = {} as FeatureMap;
  for (const k of FEATURE_KEYS) m[k] = false;
  m.chat = true;
  m.pdf_analytics = true;
  m.watermarks = true;
  m.notifications = true;
  m.download_control = true;
  m.page_proxy = true;
  m.brand_custom = true;
  m.nda = true;
  m.password_links = true;
  m.one_time_links = true;
  m.team_goals = true;
  m.link_share_detect = true;
  m.bulk_links = true;
  m.webhooks = true;
  m.short_links = true;
  m.qr_codes = true;
  m.targeting = true;
  m.og_previews = true;
  m.public_api = true;
  m.unbranded_redirect = false;
  m.splash_logo = false;
  m.hide_brand_flag = false;
  // email providers off until super enables / tenant configures
  m.emailit_platform = false;
  m.emailit_custom = true;
  m.smtp_email = true;
  return m;
}

/** Demo account gets everything on for showcase */
export function demoFeatures(): FeatureMap {
  const m = defaultFeatures();
  for (const k of FEATURE_KEYS) m[k] = true;
  m.unbranded_redirect = false;
  return m;
}

export function featuresFromRows(
  rows: { feature_key: string; enabled: boolean }[],
  base: FeatureMap = defaultFeatures(),
): FeatureMap {
  const m = { ...base };
  for (const r of rows) {
    if ((FEATURE_KEYS as readonly string[]).includes(r.feature_key)) {
      m[r.feature_key as FeatureKey] = Boolean(r.enabled);
    }
  }
  return m;
}
