/**
 * Server-only secrets. Never import from client components.
 * Set via environment variables in production.
 */
export { PLATFORM_LINK_HOST } from "./brand";

export function getPlatformEmailitKey(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.EMAILIT_API_KEY?.trim() : "";
  return fromEnv ?? "";
}

export function getGoogleClientId(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.GOOGLE_CLIENT_ID?.trim() : "";
  return fromEnv ?? "";
}

export function getGoogleClientSecret(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.GOOGLE_CLIENT_SECRET?.trim() : "";
  return fromEnv ?? "";
}

/** Platform owner – Super Admin for all workspaces (no separate /super UI). */
export const SUPER_ADMIN_EMAIL = "admin@bestl.ink";

/** Seeded super-admin password — override in production via SUPER_ADMIN_PASSWORD. */
export const SUPER_ADMIN_PASSWORD =
  (typeof process !== "undefined" ? process.env.SUPER_ADMIN_PASSWORD?.trim() : "") ||
  "change-me";
