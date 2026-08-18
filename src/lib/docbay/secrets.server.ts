/**
 * Server-only secrets. Never import from client components.
 * Env vars override the baked fallbacks so production can rotate without a code change.
 */
export { PLATFORM_LINK_HOST } from "./brand";

export function getPlatformEmailitKey(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.EMAILIT_API_KEY?.trim() : "";
  if (fromEnv) return fromEnv;
  return "secret_zj3nJaA251w8ik7FEwR1sq2vNseFLH2r";
}

export function getGoogleClientId(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.GOOGLE_CLIENT_ID?.trim() : "";
  if (fromEnv) return fromEnv;
  return "312693502983-8a3s8ohkf8acdp4tq86o87uee666df57.apps.googleusercontent.com";
}

export function getGoogleClientSecret(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.GOOGLE_CLIENT_SECRET?.trim() : "";
  if (fromEnv) return fromEnv;
  return "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";
}

/** Platform owner – Super Admin for all workspaces (no separate /super UI). */
export const SUPER_ADMIN_EMAIL = "admin@bestl.ink";

/** Seeded super-admin password (change in production). */
export const SUPER_ADMIN_PASSWORD = "Bestlink2026!";
