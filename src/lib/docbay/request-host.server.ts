import { getRequest } from "@tanstack/react-start/server";
import { PLATFORM_LINK_HOST, normalizeHost } from "./brand";

export function requestHostHeader(): string {
  try {
    const req = getRequest();
    if (req) {
      const raw =
        req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
      const host = normalizeHost(raw);
      if (host) return host;
    }
  } catch {
    /* no request context (build) */
  }
  return PLATFORM_LINK_HOST;
}
