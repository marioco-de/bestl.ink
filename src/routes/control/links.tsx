import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Ban, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useControlData, useSetControlData } from "@/lib/docbay/use-control";
import { revokeLink } from "@/lib/docbay/api";
import { formatDateDe, cn } from "@/lib/utils";
import type { FullState } from "@/lib/docbay/types";
import { ShortsWorkspace } from "./shorts";
import { ResourcesWorkspace } from "./resources";
import { CardsWorkspace } from "./-cards";
import { cardDownloadPath } from "@/lib/docbay/cards";
import { TagChip } from "@/components/control/tag-picker";
import { tagColor } from "@/lib/docbay/tags";
import { useT } from "@/lib/i18n";

type Tab = "urls" | "docs" | "pages" | "events" | "contacts" | "shared";

export const Route = createFileRoute("/control/links")({
  validateSearch: (s: Record<string, unknown>) => {
    const tab = (
      ["urls", "docs", "pages", "events", "contacts", "shared"].includes(String(s.tab))
        ? s.tab
        : "urls"
    ) as Tab;
    return {
      tab,
      ...(typeof s.tenant === "string" && s.tenant ? { tenant: s.tenant } : {}),
      ...(typeof s.create === "string" ? { create: s.create } : {}),
      ...(typeof s.generate === "string" ? { generate: s.generate } : {}),
    };
  },
  component: LinksHub,
});

function LinksHub() {
  const data = useControlData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const tab = search.tab || "urls";

  const counts = {
    urls: data.shorts.length,
    docs: data.resources.filter((r) => r.type === "document").length,
    pages: data.resources.filter((r) => r.type === "page").length,
    events: data.resources.filter((r) => r.type === "event").length,
    contacts: data.resources.filter((r) => r.type === "contact").length,
    shared: data.links.length,
  };

  function setTab(next: Tab) {
    void navigate({
      to: "/control/links",
      search: {
        tab: next,
        ...(typeof (search as { tenant?: string }).tenant === "string"
          ? { tenant: (search as { tenant?: string }).tenant }
          : {}),
      } as never,
    });
  }

  const titles: Record<Tab, string> = {
    urls: t("tabs.urls"),
    docs: t("tabs.docs"),
    pages: t("tabs.pages"),
    events: t("tabs.events"),
    contacts: t("tabs.contacts"),
    shared: t("tabs.shared"),
  };

  return (
    <div className="@container/hub mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {titles[tab]}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t("links.hint")}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px @min-[52rem]/app:hidden">
        {(
          [
            ["urls", "tabs.urls", counts.urls, "text-hue-azure", "bg-hue-azure"],
            ["docs", "tabs.docs", counts.docs, "text-hue-violet", "bg-hue-violet"],
            ["pages", "tabs.pages", counts.pages, "text-hue-lime", "bg-hue-lime"],
            ["events", "tabs.events", counts.events, "text-hue-amber", "bg-hue-amber"],
            ["contacts", "tabs.contacts", counts.contacts, "text-hue-ruby", "bg-hue-ruby"],
            ["shared", "tabs.shared", counts.shared, "text-hue-teal", "bg-hue-teal"],
          ] as const
        ).map(([id, key, n, text, bar]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative shrink-0 px-3 py-2 text-sm transition-colors duration-150",
              tab === id ? text : "text-fg-muted hover:text-fg",
            )}
          >
            {t(key)}
            <span className="ml-1.5 tabular text-xs text-fg-subtle">{n}</span>
            {tab === id && (
              <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full", bar)} />
            )}
          </button>
        ))}
      </div>

      {tab === "urls" && <ShortsWorkspace hideChrome />}
      {tab === "docs" && <ResourcesWorkspace typeFilter="document" hideChrome />}
      {tab === "pages" && <ResourcesWorkspace typeFilter="page" hideChrome />}
      {tab === "events" && <CardsWorkspace kind="event" />}
      {tab === "contacts" && <CardsWorkspace kind="contact" />}
      {tab === "shared" && <SharedPanel />}
    </div>
  );
}

function SharedPanel() {
  const data = useControlData();
  const setGlobal = useSetControlData();
  const buttons = useMemo(
    () =>
      data.params
        .filter((p) => p.kind === "button")
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [data.params],
  );
  const [tab, setTab] = useState("all");
  const filtered = data.links.filter((l) =>
    tab === "all" ? true : l.button_id === tab,
  );

  function publicUrl(slug: string | undefined, token: string, link: (typeof data.links)[0]) {
    if (link.resource_type === "event" || link.resource_type === "contact") {
      return `${window.location.origin}${cardDownloadPath(link.resource_id, token)}`;
    }
    const host = data.tenant.public_host || window.location.host;
    const path = (slug || "link").includes(".") ? `/${slug}` : `/${slug || "link"}/`;
    const params = new URLSearchParams();
    params.set("access", token);
    if (link.utm_source) params.set("utm_source", link.utm_source);
    if (link.utm_medium) params.set("utm_medium", link.utm_medium);
    if (link.utm_campaign) params.set("utm_campaign", link.utm_campaign);
    return `https://${host}${path}?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        <TabChip active={tab === "all"} onClick={() => setTab("all")}>
          Alle
        </TabChip>
        {buttons.map((b) => (
          <TabChip key={b.id} active={tab === b.id} onClick={() => setTab(b.id)}>
            {b.name}
          </TabChip>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-fg-muted">
          Noch keine Token-Links. Unter Dokumente, Termine oder Kontakte „Link generieren“.
        </p>
      )}
      {filtered.map((l) => (
        <Card key={l.id} className={cn(l.revoked && "opacity-60")}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 @min-[36rem]/hub:flex-row @min-[36rem]/hub:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{l.resource_title}</p>
                  {l.revoked && <Badge variant="danger">Widerrufen</Badge>}
                  {l.one_time && <Badge variant="outline">Einmal</Badge>}
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  {l.button_name || "—"} · {l.note || "ohne Notiz"} · {l.click_count}{" "}
                  Klicks
                  {l.last_clicked_at ? ` · ${formatDateDe(l.last_clicked_at)}` : ""}
                </p>
                {(l.tags?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {l.tags.map((n) => (
                      <TagChip key={n} name={n} color={tagColor(n, data.tags)} on />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      publicUrl(l.resource_slug, l.token, l),
                    );
                    toast.success("Kopiert");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={publicUrl(l.resource_slug, l.token, l)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                {!l.revoked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const next = await revokeLink({ data: { id: l.id } });
                      setGlobal?.(next as FullState);
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TabChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs transition-colors",
        active ? "bg-primary text-primary-fg" : "bg-bg-subtle text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
