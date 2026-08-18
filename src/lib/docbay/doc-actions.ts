import type { JsonObject } from "./types";

export const DOC_ACTION_IDS = [
  "accept",
  "reject",
  "sign",
  "call",
  "email",
] as const;

export type DocActionId = (typeof DOC_ACTION_IDS)[number];

export interface DocAction {
  id: DocActionId;
  target: string;
}

export function parseDocActions(payload: JsonObject | undefined | null): DocAction[] {
  const raw = payload && Array.isArray(payload.actions) ? payload.actions : [];
  const out: DocAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { id?: unknown; target?: unknown };
    const id = String(rec.id || "");
    if (!DOC_ACTION_IDS.includes(id as DocActionId)) continue;
    if (out.some((a) => a.id === id)) continue;
    out.push({
      id: id as DocActionId,
      target: typeof rec.target === "string" ? rec.target.trim() : "",
    });
    if (out.length >= 3) break;
  }
  return out;
}

export function actionsPayload(actions: DocAction[], prev?: JsonObject): JsonObject {
  return { ...(prev || {}), actions: actions.map((a) => ({ id: a.id, target: a.target })) };
}

export type ChatMode = "off" | "shared" | "per_email";

export function parseChatMode(payload: JsonObject | undefined | null): ChatMode {
  const raw = payload && typeof payload.chat === "string" ? payload.chat : "";
  if (raw === "off" || raw === "shared" || raw === "per_email") return raw;
  return "shared";
}

export function withChatMode(mode: ChatMode, prev?: JsonObject): JsonObject {
  return { ...(prev || {}), chat: mode };
}

export function parseRequireRequest(
  payload: JsonObject | undefined | null,
  type?: string,
): boolean {
  if (payload && typeof payload.require_request === "boolean") return payload.require_request;
  return type !== "page";
}

export function withRequireRequest(on: boolean, prev?: JsonObject): JsonObject {
  return { ...(prev || {}), require_request: on };
}

export const WITHDRAWAL_DAYS = 14;
export const WITHDRAWAL_MS = WITHDRAWAL_DAYS * 24 * 60 * 60 * 1000;

export function withdrawalUntil(firstAt: Date | string): Date {
  return new Date(new Date(firstAt).getTime() + WITHDRAWAL_MS);
}

export function withdrawalLocked(firstAt: Date | string, now = Date.now()): boolean {
  return now >= withdrawalUntil(firstAt).getTime();
}
