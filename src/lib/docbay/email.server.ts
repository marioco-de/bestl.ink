import nodemailer from "nodemailer";
import { getPlatformEmailitKey } from "./secrets.server";
import type { EmailSettings } from "./types";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string | null;
  fromName?: string | null;
}

export async function sendTenantEmail(
  settings: EmailSettings | null,
  features: { emailit_platform: boolean; emailit_custom: boolean; smtp_email: boolean },
  input: SendEmailInput,
): Promise<{ ok: boolean; error?: string; provider?: string }> {
  if (!settings || settings.provider === "none") {
    return { ok: false, error: "Kein E-Mail-Provider konfiguriert" };
  }

  const fromName = input.fromName || settings.from_name || "BESTL.INK";
  const fromEmail = input.fromEmail || settings.from_email || "noreply@bestl.ink";
  const from = `${fromName} <${fromEmail}>`;

  try {
    if (settings.provider === "emailit_platform") {
      if (!features.emailit_platform) {
        return { ok: false, error: "Platform-Emailit ist für diesen Account deaktiviert" };
      }
      const key = getPlatformEmailitKey();
      if (!key) return { ok: false, error: "EMAILIT_API_KEY fehlt" };
      return await sendEmailit(key, from, input);
    }
    if (settings.provider === "emailit_custom") {
      if (!features.emailit_custom) {
        return { ok: false, error: "Eigene Emailit-API ist deaktiviert" };
      }
      if (!settings.emailit_api_key) {
        return { ok: false, error: "Kein Emailit API-Key hinterlegt" };
      }
      return await sendEmailit(settings.emailit_api_key, from, input);
    }
    if (settings.provider === "smtp") {
      if (!features.smtp_email) {
        return { ok: false, error: "SMTP/IMAP ist für diesen Account deaktiviert" };
      }
      return await sendSmtp(settings, from, input);
    }
    return { ok: false, error: "Unbekannter Provider" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Senden fehlgeschlagen" };
  }
}

async function sendEmailit(
  apiKey: string,
  from: string,
  input: SendEmailInput,
): Promise<{ ok: boolean; error?: string; provider?: string }> {
  const res = await fetch("https://api.emailit.com/v2/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      tracking: { loads: true, clicks: false },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Emailit ${res.status}: ${text.slice(0, 200)}`,
      provider: "emailit",
    };
  }
  return { ok: true, provider: "emailit" };
}

/** Password-reset and other auth mail — always via platform Emailit. */
export async function sendPlatformAuthEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = getPlatformEmailitKey();
  if (!key) return { ok: false, error: "EMAILIT_API_KEY fehlt" };
  return sendEmailit(
    key,
    "BESTL.INK <noreply@bestl.ink>",
    { to: input.to, subject: input.subject, html: input.html },
  );
}

async function sendSmtp(
  settings: EmailSettings,
  from: string,
  input: SendEmailInput,
): Promise<{ ok: boolean; error?: string; provider?: string }> {
  if (!settings.smtp_host || !settings.smtp_user) {
    return { ok: false, error: "SMTP Host/User fehlen" };
  }
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: Boolean(settings.smtp_secure && (settings.smtp_port || 587) === 465),
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass || "",
    },
  });
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  return { ok: true, provider: "smtp" };
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}
