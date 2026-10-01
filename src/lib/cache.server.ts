/**
 * Tiny cache: in-memory (warm isolates) plus optional Upstash / Vercel KV.
 * Fail-open — Redis errors never break redirects.
 */

type Mem = { exp: number; val: string };
const mem = new Map<string, Mem>();
const MEM_MAX = 4000;

function redisUrl(): { url: string; token: string } | null {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ""
  ).replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  if (!url || !token) return null;
  return { url, token };
}

function memGet(key: string): string | null {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  return hit.val;
}

function memSet(key: string, val: string, ttlSec: number): void {
  if (mem.size >= MEM_MAX) {
    const first = mem.keys().next().value;
    if (first) mem.delete(first);
  }
  mem.set(key, { exp: Date.now() + ttlSec * 1000, val });
}

async function redisCall(path: string, init?: RequestInit): Promise<unknown> {
  const r = redisUrl();
  if (!r) return null;
  const res = await fetch(`${r.url}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${r.token}`, ...(init?.headers || {}) },
    signal: AbortSignal.timeout(800),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: unknown };
  return json.result ?? null;
}

async function redisPipeline(cmds: unknown[][]): Promise<unknown> {
  const r = redisUrl();
  if (!r) return null;
  const res = await fetch(`${r.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${r.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmds),
    signal: AbortSignal.timeout(800),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const local = memGet(key);
  if (local != null) {
    try {
      return JSON.parse(local) as T;
    } catch {
      return null;
    }
  }
  try {
    const raw = await redisCall(`/get/${encodeURIComponent(key)}`);
    if (typeof raw !== "string") return null;
    memSet(key, raw, 30);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const raw = JSON.stringify(value);
  memSet(key, raw, ttlSec);
  try {
    await redisPipeline([["SET", key, raw, "EX", Math.max(1, ttlSec)]]);
  } catch {
    /* ignore */
  }
}

export async function cacheDel(key: string): Promise<void> {
  mem.delete(key);
  try {
    await redisPipeline([["DEL", key]]);
  } catch {
    /* ignore */
  }
}

export async function cacheIncr(key: string): Promise<number> {
  const cur = (await cacheGet<number>(key)) || 0;
  const next = cur + 1;
  await cacheSet(key, next, 86400);
  return next;
}

/** Keep work alive after the HTTP response (Vercel waitUntil / local fire-and-forget). */
export function afterResponse(work: Promise<unknown>): void {
  const g = globalThis as typeof globalThis & {
    waitUntil?: (p: Promise<unknown>) => void;
  };
  const p = work.catch(() => undefined);
  if (typeof g.waitUntil === "function") g.waitUntil(p);
  else void p;
}
