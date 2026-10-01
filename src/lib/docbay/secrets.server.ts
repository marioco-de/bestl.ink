/**
 * Server-only secrets. Never import from client components.
 * Credentials come from the environment only — never from source.
 */
export { PLATFORM_LINK_HOST } from "./brand";

function env(name: string): string {
  if (typeof process === "undefined") return "";
  return process.env[name]?.trim() || "";
}

export function getPlatformEmailitKey(): string {
  return env("EMAILIT_API_KEY");
}

export function getGoogleClientId(): string {
  return env("GOOGLE_CLIENT_ID");
}

export function getGoogleClientSecret(): string {
  return env("GOOGLE_CLIENT_SECRET");
}

/** Platform owner – Super Admin for all workspaces (no separate /super UI). */
export const SUPER_ADMIN_EMAIL = "admin@bestl.ink";

/** Set SUPER_ADMIN_PASSWORD in the environment to seed the platform owner. */
export function getSuperAdminPassword(): string {
  return env("SUPER_ADMIN_PASSWORD");
}