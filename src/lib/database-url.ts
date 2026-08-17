/**
 * Resolve a Postgres URL from Vercel/Neon env names.
 * Neon’s integration often sets POSTGRES_* / DATABASE_URL_UNPOOLED
 * but not DATABASE_URL.
 */
const RUNTIME_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_NO_SSL",
] as const;

const MIGRATE_KEYS = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_NO_SSL",
] as const;

function firstEnv(keys: readonly string[]): string | undefined {
  if (typeof process === "undefined") return undefined;
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function resolveDatabaseUrl(): string | undefined {
  return firstEnv(RUNTIME_KEYS);
}

export function resolveMigrateDatabaseUrl(): string | undefined {
  return firstEnv(MIGRATE_KEYS) ?? resolveDatabaseUrl();
}

export function isDatabaseConfigured(): boolean {
  return Boolean(resolveDatabaseUrl());
}
