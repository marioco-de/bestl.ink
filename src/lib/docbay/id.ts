export function uid(prefix = ""): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 14)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${id}` : id;
}

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Production tokens: 10 chars (~3.6e15). Demo keeps short known tokens. */
export function genToken(len = 10): string {
  const alphabet = TOKEN_ALPHABET;
  const span = alphabet.length;
  const limit = Math.floor(256 / span) * span;
  const bytes = new Uint8Array(len);
  let out = "";
  while (out.length < len) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;
      out += alphabet[b % span]!;
      if (out.length === len) break;
    }
  }
  return out;
}

export async function hashSecret(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySecret(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return true;
  const h = await hashSecret(plain);
  return h === hash;
}

export function isBotUa(ua: string | null | undefined): boolean {
  if (!ua) return false;
  const s = ua.toLowerCase();
  return /bot|crawler|spider|slurp|bingpreview|linkedinbot|facebookexternalhit|whatsapp|telegrambot|preview|safelinks|proofpoint|barracuda|mime-attachment|java\/|curl|wget|python-requests|go-http|headless/i.test(
    s,
  );
}

export function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseJsonObj(raw: unknown): import("./types").JsonObject {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as import("./types").JsonObject;
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" && !Array.isArray(p)
        ? (p as import("./types").JsonObject)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}
