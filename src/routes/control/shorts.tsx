import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Plus,
  QrCode,
  Trash2,
  Pencil,
  Ban,
  BarChart3,
  KeyRound,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HueButton } from "@/components/ui/hue-button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { useControlData, useSetControlData, useOpenCreate } from "@/lib/docbay/use-control";
import {
  createShort,
  updateShort,
  deleteShort,
  toggleShort,
  getShortAnalytics,
  qrForUrl,
  createWorkspaceApiKey,
  deleteWorkspaceApiKey,
} from "@/lib/docbay/shorts-api";
import { pinShortDash } from "@/lib/docbay/dashboard-api";
import { useT } from "@/lib/i18n";
import { Toggle } from "@/components/ui/toggle";
import type { FullState, ShortLink } from "@/lib/docbay/types";
import { upsertShort, removeShort } from "@/lib/docbay/state-patch";
import { formatDateDe, cn } from "@/lib/utils";
import { TagChip } from "@/components/control/tag-picker";
import { tagColor } from "@/lib/docbay/tags";
import { ActivityList, PresenceEye } from "@/components/control/presence-eye";
import { RowMenu, VisitMeta } from "@/components/control/row-menu";

export const Route = createFileRoute("/control/shorts")({
  validateSearch: (s: Record<string, unknown>) => ({
    create: typeof s.create === "string" ? s.create : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/control/links",
      search: {
        tab: "urls",
        create: search.create,
      } as never,
    });
  },
  component: () => null,
});

export function ShortsWorkspace({
  seedUrl,
  forceCreate,
  hideChrome,
}: {
  seedUrl?: string;
  forceCreate?: boolean;
  hideChrome?: boolean;
}) {
  const data = useControlData();
  const setGlobal = useSetControlData();
  const openCreate = useOpenCreate();
  const t = useT();
  const [state, setState] = useState(data);
  const [editor, setEditor] = useState<Partial<ShortLink> | "new" | null>(null);
  const [statsFor, setStatsFor] = useState<ShortLink | null>(null);
  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);

  useEffect(() => setState(data), [data]);

  async function refresh(s: FullState) {
    setState(s);
    setGlobal?.(s);
  }

  if (!state.features.short_links) {
    return (
      <div className="mx-auto max-w-lg text-sm text-fg-muted">
        Kurzlinks sind für diesen Account deaktiviert.
      </div>
    );
  }

  const host = state.tenant.public_host;

  return (
    <div className={hideChrome ? "space-y-4" : "mx-auto max-w-5xl space-y-6"}>
      {!hideChrome && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Kurzlinks
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              Nur die URL kürzen – optional QR, Targeting, Analytics.
            </p>
          </div>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Kurzlink
          </Button>
        </div>
      )}

      {hideChrome && (
        <div className="flex justify-end">
          <HueButton hue="azure" size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> {t("short.addUrl")}
          </HueButton>
        </div>
      )}

      <div className="overflow-visible rounded-lg border border-border">
        {state.shorts.length === 0 && (
          <p className="p-5 text-sm text-fg-muted">
            Noch keine URLs. Oben einfügen und kürzen – fertig.
          </p>
        )}
        {state.shorts.map((s, i) => (
          <ShortRow
            key={s.id}
            s={s}
            i={i}
            host={host}
            state={state}
            refresh={refresh}
            onQr={setQr}
            onStats={setStatsFor}
            onEdit={setEditor}
          />
        ))}
      </div>

      {state.features.public_api && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> REST API & Bookmarklet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-fg-muted">
              POST /api/v1/shorts mit{" "}
              <span className="font-mono text-xs">Authorization: Bearer ltis_…</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await createWorkspaceApiKey({
                      data: { name: "API", tenant_id: state.tenant.id },
                    });
                    if (res.row) {
                      await refresh({
                        ...state,
                        apiKeys: [res.row, ...state.apiKeys],
                      });
                    }
                    await navigator.clipboard.writeText(res.token).catch(() => undefined);
                    toast.success("Key erzeugt und kopiert");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Fehler");
                  }
                }}
              >
                API-Key erzeugen
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const js = `javascript:(function(){window.open(location.origin+'/control/links?tab=urls&create='+encodeURIComponent(location.href),'_blank')})();`;
                  void navigator.clipboard.writeText(js);
                  toast.success("Bookmarklet kopiert");
                }}
              >
                <Bookmark className="h-3.5 w-3.5" /> Bookmarklet
              </Button>
            </div>
            <ul className="space-y-1">
              {state.apiKeys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-mono">
                    {k.prefix}… · {k.name}
                  </span>
                  <button
                    type="button"
                    className="text-danger"
                    onClick={async () => {
                      const next = await deleteWorkspaceApiKey({
                        data: { id: k.id, tenant_id: state.tenant.id },
                      });
                      await refresh({
                        ...state,
                        apiKeys: state.apiKeys.filter((x) => x.id !== next.id),
                      });
                    }}
                  >
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {editor && (
        <ShortEditor
          initial={editor === "new" ? { destination: seedUrl && seedUrl !== "1" ? seedUrl : "" } : editor}
          state={state}
          onClose={() => setEditor(null)}
          onSaved={async (s) => {
            await refresh(s);
            setEditor(null);
          }}
        />
      )}
      {statsFor && (
        <StatsModal
          short={statsFor}
          tenantId={state.tenant.id}
          onClose={() => setStatsFor(null)}
        />
      )}
      {qr && (
        <FullScreenModal
          title="QR-Code"
          description={qr.url}
          onClose={() => setQr(null)}
          footer={
            <Button
              className="min-h-11"
              onClick={() => {
                const blob = new Blob([qr.svg], { type: "image/svg+xml" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "bestlink-qr.svg";
                a.click();
              }}
            >
              SVG speichern
            </Button>
          }
        >
          <div
            className="mx-auto max-w-xs rounded-md bg-bg p-3"
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
        </FullScreenModal>
      )}
    </div>
  );
}

function ShortRow({
  s,
  i,
  host,
  state,
  refresh,
  onQr,
  onStats,
  onEdit,
}: {
  s: ShortLink;
  i: number;
  host: string;
  state: FullState;
  refresh: (s: FullState) => Promise<void>;
  onQr: (v: { url: string; svg: string }) => void;
  onStats: (s: ShortLink) => void;
  onEdit: (s: ShortLink) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const url = `https://${host}/${s.slug}`;
  return (
    <div className={cn("px-3 py-2.5", i > 0 && "border-t border-border", s.disabled && "opacity-60")}>
      <div
        className="flex cursor-pointer flex-col gap-2 @min-[40rem]/hub:flex-row @min-[40rem]/hub:items-center @min-[40rem]/hub:justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PresenceEye presence={s.presence} />
            <p className="truncate text-sm font-medium">{s.title || s.slug}</p>
            {s.disabled && <Badge variant="danger">aus</Badge>}
            {s.cloak && <Badge variant="secondary">Cloak</Badge>}
            {s.has_password && <Badge variant="outline">Passwort</Badge>}
            {s.button_name && <Badge variant="secondary">{s.button_name}</Badge>}
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">
            {url}
            <span className="text-fg-subtle"> → {s.destination}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <VisitMeta
            clicks={s.human_click_count}
            at={s.last_clicked_at ? formatDateDe(s.last_clicked_at) : null}
            lastLabel={t("links.lastVisit")}
          />
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Kopiert");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {state.features.qr_codes && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await qrForUrl({ data: { url } });
                    onQr({ url, svg: res.svg });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "QR-Fehler");
                  }
                }}
              >
                <QrCode className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => onStats(s)}>
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
            <RowMenu
              items={[
                { label: t("links.edit"), icon: Pencil, onClick: () => onEdit(s) },
                {
                  label: s.disabled ? t("links.enable") : t("links.disable"),
                  icon: Ban,
                  onClick: () => {
                    void toggleShort({
                      data: { id: s.id, disabled: !s.disabled, tenant_id: state.tenant.id },
                    }).then((next) => refresh(upsertShort(state, next.short)));
                  },
                },
                {
                  label: t("links.delete"),
                  icon: Trash2,
                  danger: true,
                  onClick: () => {
                    if (!confirm("Kurzlink löschen?")) return;
                    void deleteShort({
                      data: { id: s.id, tenant_id: state.tenant.id },
                    }).then((next) => refresh(removeShort(state, next.id)));
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 border-t border-border/70 pt-2" onClick={(e) => e.stopPropagation()}>
          {(s.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {s.tags.map((n) => (
                <TagChip key={n} name={n} color={tagColor(n, state.tags)} on />
              ))}
            </div>
          )}
          {s.note && <p className="text-xs text-fg-muted">{s.note}</p>}
          <p className="text-[11px] font-medium text-fg">{t("eye.activity")}</p>
          <ActivityList tenantId={state.tenant.id} shortId={s.id} />
        </div>
      )}
    </div>
  );
}

function ShortEditor({
  initial,
  state,
  onClose,
  onSaved,
}: {
  initial: Partial<ShortLink>;
  state: FullState;
  onClose: () => void;
  onSaved: (s: FullState) => Promise<void>;
}) {
  const [destination, setDestination] = useState(initial.destination || "");
  const [slug, setSlug] = useState(initial.slug || "");
  const [title, setTitle] = useState(initial.title || "");
  const [note, setNote] = useState(initial.note || "");
  const [password, setPassword] = useState("");
  const [expiresHours, setExpiresHours] = useState("");
  const [maxClicks, setMaxClicks] = useState(
    initial.max_clicks != null ? String(initial.max_clicks) : "",
  );
  const [cloak, setCloak] = useState(Boolean(initial.cloak));
  const [ios, setIos] = useState(initial.ios_url || "");
  const [android, setAndroid] = useState(initial.android_url || "");
  const [geo, setGeo] = useState(
    Object.entries(initial.geo_rules || {})
      .map(([k, v]) => `${k} ${v}`)
      .join("\n"),
  );
  const [ogTitle, setOgTitle] = useState(initial.og_title || "");
  const [ogDesc, setOgDesc] = useState(initial.og_description || "");
  const [descOpen, setDescOpen] = useState(Boolean(initial.og_description));
  const [ogImage, setOgImage] = useState(initial.og_image || "");
  const [buttonId, setButtonId] = useState(initial.button_id || "");
  const [utmS, setUtmS] = useState(initial.utm_source || "");
  const [utmM, setUtmM] = useState(initial.utm_medium || "");
  const [utmC, setUtmC] = useState(initial.utm_campaign || "");
  const [busy, setBusy] = useState(false);
  const [pinDash, setPinDash] = useState(false);
  const [dashDisplay, setDashDisplay] = useState<"text" | "icon" | "preview">("text");
  const t = useT();

  const buttons = useMemo(
    () => state.params.filter((p) => p.kind === "button"),
    [state.params],
  );

  function parseGeo(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of geo.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const [cc, ...rest] = t.split(/\s+/);
      if (cc && rest.length) out[cc.toUpperCase()] = rest.join(" ");
    }
    return out;
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        destination,
        slug: slug || undefined,
        title,
        note,
        password: password || undefined,
        expires_hours: expiresHours ? Number(expiresHours) : null,
        max_clicks: maxClicks ? Number(maxClicks) : null,
        cloak,
        ios_url: ios || undefined,
        android_url: android || undefined,
        geo_rules: parseGeo(),
        og_title: ogTitle || undefined,
        og_description: ogDesc || undefined,
        og_image: ogImage || undefined,
        button_id: buttonId || null,
        utm_source: utmS || undefined,
        utm_medium: utmM || undefined,
        utm_campaign: utmC || undefined,
        tenant_id: state.tenant.id,
      };
      const result = initial.id
        ? await updateShort({ data: { ...payload, id: initial.id } })
        : await createShort({ data: payload });
      let next = upsertShort(state, result.short);
      if (pinDash) {
        const dash = await pinShortDash({
          data: {
            tenant_id: state.tenant.id,
            short_id: result.short.id,
            label: title || note || result.short.slug,
            display: dashDisplay,
            image: ogImage || null,
          },
        });
        next = { ...next, dash };
      }
      await onSaved(next);
      toast.success(initial.id ? "Aktualisiert" : "Kurzlink angelegt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenModal
      title={initial.id ? "Kurzlink bearbeiten" : "Kurzlink anlegen"}
      description="Nur URL reicht. Rest ist optional."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button className="min-h-11" disabled={busy} onClick={() => void save()}>
            {busy ? "…" : "Speichern"}
          </Button>
        </>
      }
    >
      <div>
        <Label>Ziel-URL</Label>
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="https://www.firma.de/kampagne"
          autoFocus
        />
      </div>
      <div>
        <Label>Slug (leer = automatisch)</Label>
        <Input
          className="font-mono"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>
      <div className="space-y-2 rounded-md border border-border p-3">
        <Toggle label={t("dash.pin")} checked={pinDash} onChange={setPinDash} />
        {pinDash && (
          <select
            className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
            value={dashDisplay}
            onChange={(e) =>
              setDashDisplay(e.target.value as "text" | "icon" | "preview")
            }
          >
            <option value="text">{t("dash.asText")}</option>
            <option value="icon">{t("dash.asIcon")}</option>
            <option value="preview">{t("dash.asPreview")}</option>
          </select>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("short.title")}</Label>
          {!descOpen && (
            <button
              type="button"
              onClick={() => setDescOpen(true)}
              className="inline-flex h-7 items-center gap-1 text-[11px] text-fg-muted hover:text-fg"
            >
              <Plus className="h-3 w-3" />
              {t("short.addDescription")}
            </button>
          )}
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        {descOpen && (
          <div>
            <Label>{t("short.publicDesc")}</Label>
            <Textarea
              value={ogDesc}
              onChange={(e) => setOgDesc(e.target.value)}
              placeholder={t("short.publicDescPh")}
            />
          </div>
        )}
      </div>
      <div>
        <Label>{t("short.teamOnly")}</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Passwort (optional)</Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label>Ablauf (Stunden)</Label>
          <Input
            type="number"
            min={0}
            value={expiresHours}
            onChange={(e) => setExpiresHours(e.target.value)}
          />
        </div>
        <div>
          <Label>Max. Klicks</Label>
          <Input
            type="number"
            min={0}
            value={maxClicks}
            onChange={(e) => setMaxClicks(e.target.value)}
          />
        </div>
        <Toggle label="Cloak" checked={cloak} onChange={setCloak} />
      </div>
      {state.features.targeting && (
        <>
          <div>
            <Label>iOS-URL</Label>
            <Input value={ios} onChange={(e) => setIos(e.target.value)} />
          </div>
          <div>
            <Label>Android-URL</Label>
            <Input value={android} onChange={(e) => setAndroid(e.target.value)} />
          </div>
          <div>
            <Label>Geo-Regeln</Label>
            <Textarea
              className="font-mono text-xs"
              value={geo}
              onChange={(e) => setGeo(e.target.value)}
              placeholder={"DE https://firma.de/de"}
            />
          </div>
        </>
      )}
      {state.features.og_previews && (
        <>
          <div>
            <Label>OG-Titel</Label>
            <Input value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} />
          </div>
          <div>
            <Label>OG-Bild-URL</Label>
            <Input value={ogImage} onChange={(e) => setOgImage(e.target.value)} />
          </div>
        </>
      )}
      <div>
        <Label>Attribution-Button</Label>
        <select
          className="flex h-11 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm"
          value={buttonId}
          onChange={(e) => setButtonId(e.target.value)}
        >
          <option value="">— keiner —</option>
          {buttons.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>utm_source</Label>
          <Input className="font-mono" value={utmS} onChange={(e) => setUtmS(e.target.value)} />
        </div>
        <div>
          <Label>utm_medium</Label>
          <Input className="font-mono" value={utmM} onChange={(e) => setUtmM(e.target.value)} />
        </div>
        <div>
          <Label>utm_campaign</Label>
          <Input className="font-mono" value={utmC} onChange={(e) => setUtmC(e.target.value)} />
        </div>
      </div>
    </FullScreenModal>
  );
}

function StatsModal({
  short,
  tenantId,
  onClose,
}: {
  short: ShortLink;
  tenantId: string;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getShortAnalytics>> | null>(
    null,
  );
  useEffect(() => {
    void getShortAnalytics({ data: { id: short.id, tenant_id: tenantId } }).then(setStats);
  }, [short.id, tenantId]);

  return (
    <FullScreenModal
      title="Analytics"
      description={short.title || short.slug}
      onClose={onClose}
    >
      {!stats && <p className="text-sm text-fg-muted">Lade…</p>}
      {stats && (
        <div className="space-y-4">
          <p className="text-sm">
            {stats.human} Human · {stats.total} gesamt
          </p>
          {(
            [
              ["Geräte", stats.devices],
              ["OS", stats.os],
              ["Browser", stats.browsers],
              ["Länder", stats.countries],
              ["Referrer", stats.referrers],
            ] as const
          ).map(([label, rows]) => (
            <div key={label}>
              <p className="mb-1 text-xs font-medium text-fg-muted">{label}</p>
              {rows.length === 0 && (
                <p className="text-xs text-fg-subtle">Noch keine Daten</p>
              )}
              {rows.slice(0, 6).map((r) => (
                <div
                  key={r.name}
                  className="flex justify-between text-xs text-fg-muted"
                >
                  <span className="truncate">{r.name}</span>
                  <span className="tabular">{r.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </FullScreenModal>
  );
}
