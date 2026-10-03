import { createServerFn } from "@tanstack/react-start";
import { LEGAL_OPERATOR } from "./legal";
import { sendPlatformAuthEmail } from "./email.server";

const KINDS = new Set(["illegal", "privacy", "security", "access", "other"]);

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => {
    const name = c === "&" ? "amp" : c === "<" ? "lt" : c === ">" ? "gt" : "quot";
    return "&" + name + ";";
  });
}

export const submitLegalReport = createServerFn({ method: "POST" })
  .inputValidator((input: { kind?: string; email?: string; url?: string; message?: string; company?: string }) => input)
  .handler(async ({ data }) => {
    if (data.company) return { ok: true as const };
    const kind = KINDS.has(String(data.kind)) ? String(data.kind) : "other";
    const message = String(data.message || "").trim().slice(0, 4000);
    const email = String(data.email || "").trim().slice(0, 200);
    const url = String(data.url || "").trim().slice(0, 500);
    if (message.length < 8) return { ok: false as const, error: "short" };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "email" };
    const sent = await sendPlatformAuthEmail({
      to: process.env.LEGAL_EMAIL || LEGAL_OPERATOR.email,
      subject: `BESTL.LINK ${kind}`,
      html: `<p><strong>${esc(kind)}</strong></p><p>${esc(email || "keine Adresse")}</p><p>${esc(url)}</p><p>${esc(message).replace(/\n/g, "<br>")}</p>`,
    });
    if (!sent.ok) return { ok: false as const, error: "send", email: LEGAL_OPERATOR.email };
    return { ok: true as const };
  });
