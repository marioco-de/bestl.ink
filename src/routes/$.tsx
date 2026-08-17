import { createFileRoute, redirect, isRedirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  resolveAccess,
  submitAccessRequest,
  listChat,
  postChat,
  trackView,
} from "@/lib/docbay/api";
import { resolveShort } from "@/lib/docbay/shorts-api";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Globe,
  Lock,
  Mail,
  Phone,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  Send,
  CalendarDays,
  Contact,
} from "lucide-react";
import { toast } from "sonner";
import {
  cardDownloadPath,
  contactInitials,
  eventDayParts,
  formatEventWhen,
  parseContactPayload,
  parseEventPayload,
} from "@/lib/docbay/cards";

type Search = {
  access?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

async function requestHost(): Promise<string> {
  if (typeof window !== "undefined") return window.location.host;
  const { getRequestHost } = await import("@tanstack/react-start/server");
  return getRequestHost({ xForwardedHost: true }) || "";
}

export const Route = createFileRoute("/$")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    access: typeof s.access === "string" ? s.access : undefined,
    utm_source: typeof s.utm_source === "string" ? s.utm_source : undefined,
    utm_medium: typeof s.utm_medium === "string" ? s.utm_medium : undefined,
    utm_campaign: typeof s.utm_campaign === "string" ? s.utm_campaign : undefined,
  }),
  loaderDeps: ({ search }) => ({ access: search.access }),
  loader: async ({ params, deps }) => {
    const slug = (params._splat || "").replace(/\/$/, "");
    if (!slug || slug.startsWith("control") || slug.startsWith("super") || slug.startsWith("api") || slug.startsWith("login") || slug.startsWith("signup")) {
      throw new Error("NOT_FOUND");
    }
    const host = await requestHost();
    const ua =
      typeof navigator !== "undefined"
        ? navigator.userAgent
        : "";
    try {
      const resource = await resolveAccess({
        data: {
          slug,
          token: deps.access ?? null,
          user_agent: ua,
          host,
        },
      });
      return { kind: "resource" as const, resource };
    } catch {
      try {
        const short = await resolveShort({
          data: {
            slug,
            user_agent: ua,
            host,
            referrer: typeof document !== "undefined" ? document.referrer : "",
            lang: typeof navigator !== "undefined" ? navigator.language : "",
          },
        });
        if (
          short.access === "granted" &&
          short.destination &&
          !short.cloak &&
          !short.og
        ) {
          throw redirect({ href: short.destination, statusCode: 302 });
        }
        return short;
      } catch (err) {
        if (isRedirect(err)) throw err;
        throw new Error("NOT_FOUND");
      }
    }
  },
  component: ResourceGatePage,
  errorComponent: () => (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <p className="font-display text-xl font-semibold">Nicht gefunden</p>
    </div>
  ),
});

function ResourceGatePage() {
  const initial = Route.useLoaderData();
  if (initial && typeof initial === "object" && "kind" in initial && initial.kind === "short") {
    return <ShortHit data={initial} />;
  }
  const wrapped = initial as { kind: "resource"; resource: any };
  return <GatedResource initial={wrapped.resource} />;
}

function ShortHit({
  data,
}: {
  data: Awaited<ReturnType<typeof resolveShort>>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(pw?: string) {
    setBusy(true);
    try {
      const next = await resolveShort({
        data: {
          slug: data.short.slug,
          password: pw,
          user_agent: navigator.userAgent,
          host: location.host,
          referrer: document.referrer,
          lang: navigator.language,
        },
      });
      if (next.access === "password") {
        toast.error("Passwort falsch");
        setBusy(false);
        return;
      }
      if (next.access === "granted" && next.destination && !next.cloak) {
        window.location.replace(next.destination);
        return;
      }
      if (next.access === "granted" && next.cloak && next.destination) {
        window.location.replace(
          `${location.pathname}?cloak=1#${encodeURIComponent(next.destination)}`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (data.access === "granted" && data.destination && !data.cloak && !data.og) {
      window.location.replace(data.destination);
    }
  }, [data]);

  if (data.access === "password") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="font-display text-xl font-semibold">Passwort</h1>
          <p className="text-sm text-fg-muted">Dieser Kurzlink ist geschützt.</p>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="w-full" disabled={busy} onClick={() => void go(password)}>
            Weiter
          </Button>
        </div>
      </div>
    );
  }

  if (data.og && data.access === "granted") {
    const dest = data.destination || data.short.destination;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
        <meta property="og:title" content={data.short.og_title || data.short.title || data.short.slug} />
        <meta property="og:description" content={data.short.og_description || ""} />
        {data.short.og_image && (
          <meta property="og:image" content={data.short.og_image} />
        )}
        <a href={dest} className="text-primary underline">
          Weiter zu {data.short.title || dest}
        </a>
      </div>
    );
  }

  if (data.cloak && data.destination) {
    return (
      <iframe
        title={data.short.title || "link"}
        src={data.destination}
        className="h-dvh w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 text-sm text-fg-muted">
      Weiterleitung…
    </div>
  );
}

function GatedResource({ initial }: { initial: any }) {
  const search = Route.useSearch();
  const [data, setData] = useState(initial);
  const [password, setPassword] = useState("");
  const [ndaEmail, setNdaEmail] = useState("");

  async function retry(extra: { password?: string; nda_email?: string }) {
    const slug = data.resource.slug;
    const next = await resolveAccess({
      data: {
        slug,
        token: search.access ?? null,
        password: extra.password,
        nda_email: extra.nda_email,
        user_agent: navigator.userAgent,
      },
    });
    setData(next);
  }

  if (data.access === "granted") {
    return <GrantedView data={data} search={search} />;
  }
  if (data.access === "password") {
    return (
      <GateShell title="Passwort erforderlich" company={data.settings.company_name}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void retry({ password });
          }}
        >
          <Label>Zusatz-Passwort</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full">
            Entsperren
          </Button>
        </form>
      </GateShell>
    );
  }
  if (data.access === "nda") {
    return (
      <GateShell title="NDA akzeptieren" company={data.settings.company_name}>
        <p className="mb-4 text-sm text-fg-muted">{data.resource.nda_text}</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void retry({ nda_email: ndaEmail, password });
          }}
        >
          <Label>E-Mail zur Bestätigung</Label>
          <Input
            type="email"
            required
            value={ndaEmail}
            onChange={(e) => setNdaEmail(e.target.value)}
          />
          <Button type="submit" className="w-full">
            NDA akzeptieren & öffnen
          </Button>
        </form>
      </GateShell>
    );
  }
  return <AccessRequestView data={data} reason={data.access} />;
}

function GateShell({
  title,
  company,
  children,
}: {
  title: string;
  company: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
        <p className="text-xs text-fg-subtle">{company}</p>
        <h1 className="mt-2 font-display text-xl font-semibold">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function GrantedView({
  data,
  search,
}: {
  data: Awaited<ReturnType<typeof resolveAccess>>;
  search: Search;
}) {
  const { resource, settings, link, features } = data;
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<
    { id: string; sender_type: string; sender_name: string; body: string }[]
  >([]);
  const [chatBody, setChatBody] = useState("");
  const [visitorKey] = useState(() => {
    if (typeof window === "undefined") return "v";
    const k = localStorage.getItem("bestlink_vk") || `v_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("bestlink_vk", k);
    return k;
  });
  const startRef = useRef(Date.now());
  const pageRef = useRef(1);

  useEffect(() => {
    if (
      (resource.type === "event" || resource.type === "contact") &&
      data.download_url
    ) {
      window.location.replace(data.download_url);
    }
  }, [resource.type, data.download_url]);

  useEffect(() => {
    if (!link || !features.pdf_analytics) return;
    const t = window.setInterval(() => {
      void trackView({
        data: {
          link_id: link.id,
          page: pageRef.current,
          duration_ms: 5000,
          scroll_pct: Math.min(100, Math.round((window.scrollY / (document.body.scrollHeight || 1)) * 100)),
        },
      });
    }, 5000);
    return () => {
      window.clearInterval(t);
      void trackView({
        data: {
          link_id: link.id,
          page: pageRef.current,
          duration_ms: Date.now() - startRef.current,
          scroll_pct: 100,
        },
      });
    };
  }, [link, features.pdf_analytics]);

  useEffect(() => {
    if (!features.chat) return;
    void listChat({ data: { resource_id: resource.id, link_id: link?.id } }).then(
      setMessages,
    );
    const t = window.setInterval(() => {
      void listChat({ data: { resource_id: resource.id, link_id: link?.id } }).then(
        setMessages,
      );
    }, 4000);
    return () => window.clearInterval(t);
  }, [resource.id, link?.id, features.chat]);

  const allowDl = link?.allow_download !== false;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-xs text-fg-subtle">{settings.company_name}</p>
          <p className="truncate font-medium">{resource.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {link && (
            <Badge variant="success" className="hidden sm:inline-flex">
              via {link.button_name}
            </Badge>
          )}
          <Badge variant="secondary">
            <Lock className="mr-1 h-3 w-3" /> Geschützt
          </Badge>
          {features.chat && (
            <Button size="sm" variant="secondary" onClick={() => setChatOpen((v) => !v)}>
              <MessageSquare className="h-4 w-4" /> Chat
            </Button>
          )}
        </div>
      </header>

      <div className="relative flex flex-1">
        <div className="relative min-w-0 flex-1">
          {features.watermarks && link && (
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.07]">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute whitespace-nowrap font-mono text-sm text-fg"
                  style={{
                    top: `${(i % 4) * 25 + 10}%`,
                    left: `${Math.floor(i / 4) * 30}%`,
                    transform: "rotate(-24deg)",
                  }}
                >
                  {link.token} · {settings.company_name}
                </div>
              ))}
            </div>
          )}
          {(resource.type === "event" || resource.type === "contact") && (
            <CardGate resource={resource} downloadUrl={data.download_url} />
          )}
          {resource.type === "document" && data.content_data_url && (
            <iframe
              title={resource.title}
              src={
                allowDl
                  ? data.content_data_url
                  : `${data.content_data_url}#toolbar=0`
              }
              className="h-[calc(100dvh-57px)] w-full border-0 bg-white"
            />
          )}
          {resource.type === "page" && data.target_url && features.page_proxy && (
            <div className="relative h-[calc(100dvh-57px)]">
              <iframe
                title={resource.title}
                src={data.target_url}
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                referrerPolicy="no-referrer"
              />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-bg/90 px-3 py-1.5 text-xs text-fg-muted">
                URL bleibt {settings.domain}/{resource.slug}/
              </div>
            </div>
          )}
          {resource.type === "document" && !allowDl && (
            <p className="absolute bottom-3 right-3 rounded-lg bg-bg/90 px-2 py-1 text-xs text-fg-subtle">
              Download deaktiviert
            </p>
          )}
          {features.pdf_analytics && (
            <div className="absolute bottom-3 left-3 z-20 flex gap-1">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded bg-bg/90 px-2 py-1 text-xs text-fg-muted"
                  onClick={() => {
                    pageRef.current = p;
                    toast.message(`Seite ${p}`);
                  }}
                >
                  S{p}
                </button>
              ))}
            </div>
          )}
        </div>

        {chatOpen && features.chat && (
          <aside className="flex w-full max-w-sm flex-col border-l border-border bg-bg-elevated">
            <div className="border-b border-border px-3 py-2 text-sm font-medium">
              Chat zum Dokument
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.sender_type === "visitor"
                      ? "rounded-lg bg-primary/10 px-2 py-1.5 text-sm"
                      : "rounded-lg bg-bg-muted px-2 py-1.5 text-sm"
                  }
                >
                  <p className="text-[10px] text-fg-subtle">{m.sender_name}</p>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 border-t border-border p-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!chatBody.trim()) return;
                await postChat({
                  data: {
                    resource_id: resource.id,
                    link_id: link?.id,
                    visitor_key: visitorKey,
                    sender_type: "visitor",
                    sender_name: "Besucher",
                    body: chatBody.trim(),
                  },
                });
                setChatBody("");
                const list = await listChat({
                  data: { resource_id: resource.id, link_id: link?.id },
                });
                setMessages(list);
              }}
            >
              <Input
                value={chatBody}
                onChange={(e) => setChatBody(e.target.value)}
                placeholder="Nachricht…"
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}

function AccessRequestView({
  data,
  reason,
}: {
  data: Awaited<ReturnType<typeof resolveAccess>>;
  reason: string;
}) {
  const { resource, settings } = data;
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitAccessRequest({
        data: {
          resource_id: resource.id,
          email: email.trim(),
          phone: phone.trim() || undefined,
          message: message.trim() || undefined,
        },
      });
      setSent(true);
      toast.success("Anfrage gesendet");
    } catch {
      toast.error("Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-warning/15 text-warning">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <p className="text-xs uppercase tracking-wider text-fg-subtle">
            {settings.company_name}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Zugriff anfragen</h1>
          <p className="mt-2 text-sm text-fg-muted">
            {reason === "denied"
              ? "Token ungültig, abgelaufen oder widerrufen."
              : "Nur mit gültigem Access-Link erreichbar."}
          </p>
        </div>
        <div className="mb-6 flex items-start gap-3 rounded-md border border-border bg-card p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-muted text-fg-muted">
            {resource.type === "document" ? (
              <FileText className="h-5 w-5" />
            ) : resource.type === "event" ? (
              <CalendarDays className="h-5 w-5" />
            ) : resource.type === "contact" ? (
              <Contact className="h-5 w-5" />
            ) : (
              <Globe className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium">{resource.title}</p>
            <p className="text-sm text-fg-muted">{resource.description}</p>
          </div>
        </div>
        {sent ? (
          <div className="rounded-md border border-border bg-bg-subtle p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-medium">Anfrage eingegangen</p>
            <p className="mt-1 text-sm text-fg-muted">
              Nach Freigabe erhalten Sie eine E-Mail mit Ihrem persönlichen Link.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <div>
              <Label>
                <Mail className="mr-1 inline h-3.5 w-3.5" /> E-Mail
              </Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>
                <Phone className="mr-1 inline h-3.5 w-3.5" /> Telefon (optional)
              </Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>
                <MessageSquare className="mr-1 inline h-3.5 w-3.5" /> Nachricht
              </Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : "Zugriff anfragen"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function CardGate({
  resource,
  downloadUrl,
}: {
  resource: {
    id: string;
    type: string;
    title: string;
    payload?: Record<string, unknown>;
  };
  downloadUrl: string | null;
}) {
  const href =
    downloadUrl ||
    (typeof window !== "undefined"
      ? cardDownloadPath(
          resource.id,
          new URLSearchParams(window.location.search).get("access") || "",
        )
      : "");
  if (resource.type === "event") {
    const event = parseEventPayload(resource.payload);
    const p = eventDayParts(event.start || "");
    return (
      <div className="flex h-[calc(100dvh-57px)] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-card p-4 text-left">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-hue-amber/14 text-hue-amber">
            <span className="text-[10px] font-semibold tracking-wider">{p.month}</span>
            <span className="font-display text-xl leading-none font-semibold">{p.day}</span>
          </div>
          <div className="min-w-0">
            <p className="font-medium">{resource.title}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{formatEventWhen(event)}</p>
            {event.location ? (
              <p className="mt-0.5 truncate text-xs text-fg-subtle">{event.location}</p>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-fg-muted">Termin wird geöffnet…</p>
        {href && (
          <Button asChild>
            <a href={href}>.ics herunterladen</a>
          </Button>
        )}
      </div>
    );
  }
  const contact = parseContactPayload(resource.payload);
  return (
    <div className="flex h-[calc(100dvh-57px)] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-card p-4 text-left">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-hue-ruby/12 font-display text-lg font-semibold text-hue-ruby">
          {contactInitials(resource.title)}
        </div>
        <div className="min-w-0">
          <p className="font-medium">{resource.title}</p>
          {(contact.title || contact.company) && (
            <p className="mt-0.5 text-xs text-fg-muted">
              {[contact.title, contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
          {contact.email && (
            <p className="mt-0.5 truncate text-xs text-fg-subtle">{contact.email}</p>
          )}
        </div>
      </div>
      <p className="text-sm text-fg-muted">Kontakt wird geöffnet…</p>
      {href && (
        <Button asChild>
          <a href={href}>.vcf herunterladen</a>
        </Button>
      )}
    </div>
  );
}

