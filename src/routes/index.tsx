import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getPublicHome } from "@/lib/docbay/api";
import {
  Shield,
  Link2,
  BarChart3,
  Globe,
  Lock,
  FolderTree,
  Mail,
  MessageSquare,
  Eye,
  Fingerprint,
  Webhook,
  Stamp,
  CalendarDays,
  Contact,
  Clock,
  Download,
  Building2,
  ArrowRight,
  QrCode,
  Server,
  Cookie,
  Scale,
  Search,
} from "lucide-react";
import { NotFoundSplash } from "@/components/public/not-found-splash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return await getPublicHome();
    } catch {
      return {
        mode: "home" as const,
        product: "BESTL.INK",
        tagline: "Share less. Know more.",
        slogan: "Ein Link, keine Umwege. Kürzen. Und schützen.",
        platformHost: "bestl.ink",
        googleNative: false,
        host: "bestl.ink",
        company: "",
      };
    }
  },
  component: HomePage,
});

const FEATURES = [
  {
    icon: Server,
    title: "Hosting in Deutschland",
    text: "Links und Dateien bleiben im Inland. DSGVO-Tracking ohne Cookies – ohne Umweg über US-Clouds.",
  },
  {
    icon: Lock,
    title: "Gated Documents",
    text: "PDFs & Seiten nur mit ?access= Token. Ohne Token: Zugriff anfragen – nie offen im Netz.",
  },
  {
    icon: CalendarDays,
    title: "Termine als .ics",
    text: "Termin anlegen, Link teilen. Mit Token lädt der Empfänger eine Kalenderdatei – getrackt.",
  },
  {
    icon: Contact,
    title: "Kontakte als .vcf",
    text: "Visitenkarte hinterlegen. Der Link liefert eine vCard, die sich ins Adressbuch legt.",
  },
  {
    icon: FolderTree,
    title: "Attribution-Hierarchie",
    text: "Mitarbeiter-Buttons in Ordnern & Tags. Steckt im Token – nicht als Klartext-UTM.",
  },
  {
    icon: Link2,
    title: "Link-Generator",
    text: "Inhalt wählen, Button klicken, fertig. Notiz, Tags, Ablauf, Einmal-Link, Passwort.",
  },
  {
    icon: BarChart3,
    title: "Klick-Tracking",
    text: "Wann, wie oft, human vs. Bot. Weiterleitungs-Hinweis bei vielen IPs.",
  },
  {
    icon: Eye,
    title: "PDF Analytics",
    text: "Seiten & Verweildauer – wissen, wo der Interessent hängen bleibt.",
  },
  {
    icon: Globe,
    title: "Eigene Domain",
    text: "firma.bestl.ink out of the box – oder CNAME auf docs.eure-domain.de.",
  },
  {
    icon: QrCode,
    title: "Kurzlinks & QR",
    text: "Beliebige URLs kürzen auf eurer Domain. Custom Slugs, QR-Codes, Cloaking.",
  },
  {
    icon: Fingerprint,
    title: "Device- & Geo-Routing",
    text: "iOS, Android oder Land → andere Ziel-URL. Wie Dub, ohne Extra-Tool.",
  },
  {
    icon: Webhook,
    title: "REST API & Bookmarklet",
    text: "Shlink/YOURLS-kompatibler Workflow: API-Keys, POST /api/v1/shorts.",
  },
  {
    icon: Fingerprint,
    title: "iFrame-Proxy",
    text: "Interne Seiten unter eurer URL. Besucher sieht nie die Original-Adresse.",
  },
  {
    icon: Mail,
    title: "E-Mail bei Freigabe",
    text: "Emailit oder SMTP. Templates mit {{access_url}} – personalisiert und automatisiert.",
  },
  {
    icon: MessageSquare,
    title: "Chat im Dokument",
    text: "Besucher fragt nach, Team antwortet – direkt am geteilten Inhalt.",
  },
  {
    icon: Stamp,
    title: "NDA & Wasserzeichen",
    text: "NDA vor dem Öffnen. Token-Wasserzeichen auf dem Viewer.",
  },
  {
    icon: Download,
    title: "Download-Kontrolle",
    text: "Nur ansehen – oder Download freigeben. Pro Link einstellbar.",
  },
  {
    icon: Clock,
    title: "Ablauf & Widerruf",
    text: "Links zeitlich begrenzen, einmalig machen oder sofort killen.",
  },
  {
    icon: Webhook,
    title: "CRM-Webhooks",
    text: "Klick & Anfrage an Zapier, HubSpot & Co. – Deals bleiben warm.",
  },
  {
    icon: Building2,
    title: "Multi-Tenant SaaS",
    text: "Jeder Kunde sein Workspace. Feature-Flags pro Account.",
  },
];

function HomePage() {
  const data = Route.useLoaderData();
  if (data.mode === "miss") {
    return <NotFoundSplash host={data.host} company={data.company} />;
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 60%), radial-gradient(ellipse 40% 30% at 90% 20%, color-mix(in oklab, var(--color-info) 8%, transparent), transparent)",
        }}
      />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="metal flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold tracking-tight">
                {data.product}
              </p>
              <p className="truncate text-[11px] font-medium text-primary sm:text-xs">
                Share less. Know more.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Workspace starten</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <Server className="h-3 w-3 text-hue-teal" />
            Server in Deutschland · Tracking ohne Cookies
          </Badge>

          <h1 className="font-display max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            Ein Link, keine Umwege.
            <span className="mt-1 block text-fg-muted">
              Kürzen. Und schützen.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base text-fg-muted sm:text-lg">
            Teile Verkaufsunterlagen und interne Seiten mit Access-Token.
            Sieh, wer klickt – und welcher Mitarbeiter den Lead geholt hat.
            Ohne Klartext-Parameter. Ohne offene PDFs im Netz.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="min-h-12 px-6 text-base">
              <Link to="/signup">
                Workspace starten
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="min-h-12 px-6 text-base"
            >
              <Link to="/login">Login</Link>
            </Button>
          </div>

          <p className="mt-4 font-mono text-xs text-fg-subtle">
            Workspace unter{" "}
            <span className="text-primary">firma.{data.platformHost}</span>
            {" · "}
            oder eigene Domain
          </p>
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="grid items-start gap-10 @container lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-hue-teal">
                  Standort Deutschland
                </p>
                <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Die Links sitzen hier. Nicht in Kalifornien.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-fg-muted sm:text-base">
                  Server in Deutschland. Tracking ohne Cookies. DSGVO nicht als
                  Häkchen, sondern als Architektur: kein Consent-Banner, kein
                  US-Cloud-Act, Auftragsverarbeitung nach deutschem Recht.
                </p>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
                  In Europa gibt es nur sehr wenige Anbieter, die Links wirklich
                  kürzen und schützen. Die Plattformen mit dem großen
                  Funktionsumfang sitzen fast alle in den USA – und erfüllen die
                  DSGVO nicht in dem Maß, den europäische Teams brauchen. BESTL.INK
                  verbindet Kürzen, geschützte Dokumente und Attribution in
                  Deutschland, ohne die Daten ins Ausland zu schieben.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  {
                    icon: Server,
                    hue: "text-hue-teal bg-hue-teal/10",
                    t: "Rechenzentrum DE",
                    d: "Links, Dateien, Klickdaten bleiben in Deutschland.",
                  },
                  {
                    icon: Cookie,
                    hue: "text-hue-amber bg-hue-amber/12",
                    t: "Ohne Cookies",
                    d: "Zählung über den Access-Token, nicht über den Browser.",
                  },
                  {
                    icon: Scale,
                    hue: "text-hue-azure bg-hue-azure/10",
                    t: "DSGVO von Haus aus",
                    d: "Kein Transfer in die USA. AV-Vertrag, Löschfristen, Auskunft.",
                  },
                  {
                    icon: Shield,
                    hue: "text-hue-violet bg-hue-violet/10",
                    t: "Für Unternehmen",
                    d: "Was US-Tools mit SCC und Trust-Center nur behaupten.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.t}
                      className="flex gap-3 rounded-md border border-border bg-card p-3.5"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${item.hue}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.t}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
                          {item.d}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="border-t border-border/60 bg-bg-elevated/40"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Features
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Alles, was Sales für sichere Freigaben braucht
              </h2>
              <p className="mt-2 text-sm text-fg-muted sm:text-base">
                Von Token-Links bis CRM-Webhook – gebaut für den Moment, in dem
                du den Interessenten anrufen willst, bevor die Konkurrenz es tut.
              </p>
            </div>
            <FeatureSearch />
          </div>
        </section>

        {/* How it works strip */}
        <section className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              So läuft's
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">
              Drei Klicks. Ein messbarer Link.
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "Inhalt ablegen",
                  d: "PDF hochladen oder Seite verknüpfen. Download, NDA, Wasserzeichen einstellen.",
                },
                {
                  n: "02",
                  t: "Attribution wählen",
                  d: "Mitarbeiter-Button, Tag, Notiz. Optional UTM – nur die im Klartext.",
                },
                {
                  n: "03",
                  t: "Teilen & nachfassen",
                  d: "Token-Link raus. Klicks live sehen. Anrufen, wenn’s heiß wird.",
                },
              ].map((s) => (
                <li
                  key={s.n}
                  className="relative rounded-lg border border-border bg-card p-5"
                >
                  <span className="font-display text-2xl font-semibold text-primary/80">
                    {s.n}
                  </span>
                  <p className="mt-2 font-medium">{s.t}</p>
                  <p className="mt-1 text-sm text-fg-muted">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="relative overflow-hidden rounded-xl border border-border bg-bg-elevated px-6 py-10 sm:px-10 sm:py-12">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
              />
              <h2 className="font-display relative max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
                Bereit, Links zu teilen, die zurückrufen?
              </h2>
              <p className="relative mt-3 max-w-md text-sm text-fg-muted">
                Workspace in Minuten. Subdomain inklusive. Eigene Domain später.
              </p>
              <div className="relative mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="min-h-12 px-6">
                  <Link to="/signup">
                    Workspace starten
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="min-h-12 px-6"
                >
                  <Link to="/login">Login</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 text-xs text-fg-subtle sm:flex-row sm:items-center sm:px-6">
          <p className="font-display font-medium text-fg-muted">BESTL.INK</p>
          <p>Share less. Know more. · {data.platformHost}</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureSearch() {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return FEATURES;
    return FEATURES.filter(
      (f) =>
        f.title.toLowerCase().includes(n) || f.text.toLowerCase().includes(n),
    );
  }, [q]);
  const hues = [
    "text-hue-teal bg-hue-teal/10",
    "text-hue-azure bg-hue-azure/10",
    "text-hue-violet bg-hue-violet/10",
    "text-hue-amber bg-hue-amber/12",
    "text-hue-ruby bg-hue-ruby/10",
    "text-hue-lime bg-hue-lime/12",
  ];
  return (
    <>
      <div className="relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Features durchsuchen…"
          className="h-10 w-full rounded-md border border-border bg-bg-elevated pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 && (
          <p className="text-sm text-fg-muted">Nichts gefunden zu „{q}“.</p>
        )}
        {list.map((f, i) => {
          const Icon = f.icon;
          return (
            <article
              key={f.title}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong hover:bg-bg-subtle/40"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-md ${hues[i % hues.length]}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mt-3.5 font-display text-[15px] font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                {f.text}
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}

