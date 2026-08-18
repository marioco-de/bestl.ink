import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileStack,
  Link2,
  MousePointerClick,
  Inbox,
  Copy,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateDe, cn } from "@/lib/utils";
import { useControlData } from "@/lib/docbay/use-control";
import { toast } from "sonner";
import { QuickShorten } from "@/components/control/quick-shorten";

export const Route = createFileRoute("/control/stats")({
  component: Dashboard,
});

function Dashboard() {
  const data = useControlData();

  const stats = [
    { label: "URLs", value: data.stats.shorts, icon: Link2, hue: "text-hue-azure" },
    { label: "Dokumente", value: data.stats.resources, icon: FileStack, hue: "text-hue-violet" },
    { label: "Geteilt", value: data.stats.links, icon: Link2, hue: "text-hue-teal" },
    { label: "Klicks", value: data.stats.clicks, icon: MousePointerClick, hue: "text-hue-amber" },
    { label: "Human", value: data.stats.human_clicks, icon: Users, hue: "text-hue-lime" },
    { label: "Anfragen", value: data.stats.pending_requests, icon: Inbox, hue: "text-hue-ruby" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Übersicht</h1>
          <p className="text-sm text-fg-muted">
            {data.tenant.name}
            {data.isSuperAdmin && (
              <Badge variant="secondary" className="ml-2">
                Super Admin
              </Badge>
            )}
          </p>
          <p className="mt-1 font-mono text-xs text-primary">
            {data.tenant.public_host}
          </p>
        </div>
      </div>

      <QuickShorten />

      {data.isSuperAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Kundenverwaltung</CardTitle>
            <Button asChild size="sm">
              <Link to="/control/customers">Alle Kunden</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-fg-muted">
              {data.platformTenants?.length ?? 0} Workspaces · Pakete, Rechte,
              Nutzer und Passwörter unter Kunden.
            </p>
            {(data.platformTenants ?? []).slice(0, 5).map((row) => (
              <div
                key={row.tenant.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.tenant.name}</p>
                  <p className="truncate font-mono text-xs text-fg-subtle">
                    {row.tenant.public_host}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/control" search={{ tenant: row.tenant.id } as never}>
                    Öffnen
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.tenant.id !== "platform" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <Icon className={cn("h-4 w-4", s.hue)} />
                    <p className="mt-3 font-display text-2xl font-semibold tabular">
                      {s.value}
                    </p>
                    <p className="text-xs text-fg-muted">{s.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {data.features.team_goals && (
            <Card>
              <CardHeader>
                <CardTitle>Team-Ziele</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {data.teamGoals.map((g) => (
                  <div
                    key={g.button_id}
                    className="rounded-md border border-border bg-bg p-3"
                  >
                    <p className="font-medium">{g.name}</p>
                    <p className="mt-1 text-xs text-fg-muted">
                      {g.links} Links · {g.human_clicks} Human-Klicks ·{" "}
                      <span className="text-primary">
                        {g.hot_links} heiß (≥3)
                      </span>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Link erzeugen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.resources.length === 0 && (
                  <p className="text-sm text-fg-muted">
                    Noch keine Inhalte – unter „Inhalte“ anlegen.
                  </p>
                )}
                {data.resources.map((r) => (
                  <Link
                    key={r.id}
                    to="/control/links"
                    search={
                      {
                        tab:
                          r.type === "page"
                            ? "pages"
                            : r.type === "event"
                              ? "events"
                              : r.type === "contact"
                                ? "contacts"
                                : "docs",
                      } as never
                    }
                    className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-3 text-sm hover:border-border-strong"
                  >
                    <span className="truncate font-medium">{r.title}</span>
                    <Badge variant="secondary">
                      {r.type === "document"
                        ? "Doc"
                        : r.type === "page"
                          ? "Seite"
                          : r.type === "event"
                            ? "Termin"
                            : "Kontakt"}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Neueste Links</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/control/links" search={{ tab: "shared" } as never}>Alle</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.links.slice(0, 5).map((l) => (
                  <div
                    key={l.id}
                    className="rounded-md border border-border bg-bg p-3"
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {l.resource_title}
                        </p>
                        <p className="truncate text-xs text-fg-muted">
                          {l.note || "—"} · {l.button_name}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-fg-subtle hover:text-fg"
                        onClick={() => {
                          const host = data.tenant.public_host;
                          const path = (l.resource_slug || "").includes(".")
                            ? `/${l.resource_slug}`
                            : `/${l.resource_slug}/`;
                          void navigator.clipboard.writeText(
                            `https://${host}${path}?access=${l.token}`,
                          );
                          toast.success("Kopiert");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-fg-subtle">
                      <span className="font-mono text-primary">
                        access={l.token}
                      </span>
                      <span className="tabular">
                        {l.human_click_count}h / {l.click_count}Σ
                      </span>
                      {l.share_suspected && (
                        <Badge variant="warning">Weiterleitung?</Badge>
                      )}
                      <span>{formatDateDe(l.last_clicked_at)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
