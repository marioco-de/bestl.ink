import { ArrowRight, Link2Off, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND_HOME, BRAND_NAME, BRAND_SIGNUP, BRAND_TAGLINE } from "@/lib/docbay/brand";

export type MissReason = "missing" | "expired" | "disabled" | "limit";

const LINES: Record<MissReason, string[]> = {
  missing: [
    "Dieser Link ist kürzer als gedacht.",
    "Hier fehlt das Stück Kette.",
    "Jemand hat zu gründlich gekürzt.",
    "Nichts hinter dieser Adresse. Wirklich nichts.",
    "Der Link ist ausgerückt. Wir sind geblieben.",
    "Zu kurz gekommen — der Link, nicht du.",
  ],
  expired: [
    "Dieser Link hat Feierabend.",
    "Gültig war gestern.",
    "Die Uhr ist abgelaufen. Der Witz auch bald.",
  ],
  disabled: [
    "Dieser Link wurde stillgelegt.",
    "Absichtlich aus. Nicht verloren.",
  ],
  limit: [
    "Dieser Link hat genug Klicks gehabt.",
    "Kontingent voll. Der Vorhang fällt.",
  ],
};

function pickLine(reason: MissReason, seed: string): string {
  const list = LINES[reason];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length] ?? list[0];
}

export function NotFoundSplash({
  host,
  slug,
  company,
  reason = "missing",
}: {
  host: string;
  slug?: string;
  company?: string;
  reason?: MissReason;
}) {
  const path = slug ? `${host}/${slug}` : host;
  const line = pickLine(reason, path);
  const hint =
    reason === "expired"
      ? "Die Zeit war um. Der Inhalt bleibt, wo er hingehört."
      : reason === "disabled"
        ? "Der Absender hat den Hahn zugedreht."
        : reason === "limit"
          ? "Maximale Aufrufe erreicht — mehr gibt es nicht."
          : "Vertippt, abgelaufen oder nie angelegt. Wir wissen es nicht. Du jetzt schon.";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 44% at 50% -10%, color-mix(in oklab, var(--color-primary) 16%, transparent), transparent 62%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <a href={BRAND_HOME} className="flex items-center gap-2.5 text-fg">
          <span className="metal flex h-8 w-8 items-center justify-center rounded-md">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">{BRAND_NAME}</span>
        </a>
        <p className="hidden text-[11px] text-fg-subtle sm:block">{BRAND_TAGLINE}</p>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 pb-20 pt-6 text-center">
        <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-bg-elevated text-fg-muted">
          <Link2Off className="h-7 w-7" strokeWidth={1.6} />
        </div>

        <p className="font-mono text-[11px] tracking-wide text-fg-subtle">404 · {path}</p>
        <h1 className="mt-3 font-display text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-3xl">
          {line}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">{hint}</p>
        {company ? (
          <p className="mt-2 text-xs text-fg-subtle">
            Eigentlich ein Link von <span className="text-fg">{company}</span>. Nur halt nicht dieser.
          </p>
        ) : null}

        <div className="mt-10 w-full rounded-xl border border-border bg-bg-elevated p-5 text-left">
          <p className="font-display text-sm font-semibold">So endet ein Link besser nicht.</p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
            {BRAND_NAME} kürzt, sichert und misst — auf eurer Domain. Wenn etwas fehlt, sagen
            wir das wenigstens mit Anstand.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-fg-muted">
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
              Kurzlinks & QR auf eigener Domain
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
              Dokumente nur mit Token, nie offen im Netz
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
              Hosting in Deutschland, Tracking ohne Cookies
            </li>
          </ul>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <a href={BRAND_SIGNUP}>
                Workspace starten <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="secondary" className="flex-1">
              <a href={BRAND_HOME}>Was ist {BRAND_NAME}?</a>
            </Button>
          </div>
        </div>
      </main>

      <a
        href={BRAND_HOME}
        className="absolute bottom-0 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-2 rounded-t-md border border-b-0 border-border bg-bg-elevated px-2.5 text-[11px] text-fg-muted shadow-md hover:text-fg"
      >
        <span className="metal flex h-4 w-4 items-center justify-center rounded-sm font-display text-[8px] font-semibold text-primary-fg">
          bl
        </span>
        shortened & secured with{" "}
        <span className="font-medium text-fg">{BRAND_NAME}</span>
      </a>
    </div>
  );
}
