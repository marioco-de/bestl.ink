import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LegalLinks } from "@/components/public/legal-links";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { submitLegalReport } from "@/lib/docbay/legal.server";
import { LEGAL_OPERATOR } from "@/lib/docbay/legal";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/legal/melden")({
  component: Page,
});

const KINDS = ["illegal", "privacy", "security", "access", "other"] as const;

function Page() {
  const t = useT();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("illegal");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "err">("idle");
  const [fallback, setFallback] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("idle");
    const res = await submitLegalReport({ data: { kind, email, url, message, company } });
    if (res.ok) {
      setState("sent");
      setMessage("");
      return;
    }
    setFallback("email" in res && res.email ? res.email : LEGAL_OPERATOR.email);
    setState("err");
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-16 text-fg">
      <p className="text-xs uppercase tracking-[0.14em] text-fg-subtle">BESTL.LINK</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{t("legal.report")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">{t("legal.reportLead")}</p>
      <form onSubmit={send} className="mt-8 space-y-4">
        <div>
          <Label>{t("legal.kind")}</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
          >
            {KINDS.map((id) => (
              <option key={id} value={id}>{t(`legal.kind_${id}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>{t("legal.yourEmail")}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={LEGAL_OPERATOR.email} />
        </div>
        <div>
          <Label>{t("legal.pageUrl")}</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        <div>
          <Label>{t("legal.message")}</Label>
          <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} required />
        </div>
        <input tabIndex={-1} autoComplete="off" className="hidden" value={company} onChange={(e) => setCompany(e.target.value)} aria-hidden />
        <Button type="submit">{t("legal.send")}</Button>
        {state === "sent" ? <p className="text-sm text-fg-muted">{t("legal.sent")}</p> : null}
        {state === "err" ? (
          <p className="text-sm text-fg-muted">{t("legal.sendFail", { email: fallback })}</p>
        ) : null}
      </form>
      <LegalLinks className="mt-10 text-xs text-fg-subtle" />
    </main>
  );
}
