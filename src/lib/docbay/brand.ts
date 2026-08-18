/** Public product identity — safe to import from client and server. */
export const BRAND_NAME = "BESTL.INK";
export const PLATFORM_LINK_HOST = "bestl.ink";
export const CNAME_TARGET = `dns.${PLATFORM_LINK_HOST}`;
export const BRAND_MARK = "bl";
export const BRAND_TAGLINE = "Share less. Know more.";
export const BRAND_HOME = `https://www.${PLATFORM_LINK_HOST}`;
export const BRAND_SIGNUP = `${BRAND_HOME}/signup`;

/** Marketing site vs. a workspace / custom link domain. */
export function isMarketingHost(host: string): boolean {
  const h = host.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (!h) return true;
  if (h === PLATFORM_LINK_HOST || h === `www.${PLATFORM_LINK_HOST}`) return true;
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (h.endsWith(".localhost")) return true;
  if (h.endsWith(".grok.me") || h.endsWith(".devtunnels.ms")) return true;
  return false;
}

export function normalizeHost(host: string): string {
  return host.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}