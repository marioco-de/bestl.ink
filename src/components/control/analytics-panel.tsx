import { useEffect, useMemo, useState } from "react";
import { Download, List, MousePointerClick } from "lucide-react";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import type { AnalyticsBundle, CountRow } from "@/lib/docbay/analytics";
import { getShortAnalytics } from "@/lib/docbay/shorts-api";
import { getLinkAnalytics } from "@/lib/docbay/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const RANGES = ["24h", "7d", "30d"] as const;

function downloadCsv(stats: AnalyticsBundle, name: string) {
  const cols = ["time", "trigger", "country", "device", "os", "browser", "referrer", "bot"];
  const lines = [
    cols.join(","),
    ...stats.events.map((e) =>
      [
        e.created_at,
        e.trigger === "qr" ? "qr" : "link",
        e.country,
        e.device,
        e.os,
        e.browser,
        e.referrer,
        e.is_bot ? "1" : "0",
      ]
        .map((v) => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `analytics-${(name || "link").replace(/\W+/g, "-").slice(0, 40)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Chart({ series }: { series: { t: string; v: number }[] }) {
  const w = 640;
  const h = 180;
  const max = Math.max(1, ...series.map((s) => s.v));
  const pts = series.map((s, i) => {
    const x = series.length <= 1 ? w / 2 : (i / (series.length - 1)) * w;
    const y = h - 16 - (s.v / max) * (h - 32);
    return `${x},${y}`;
  });
  const area = `0,${h - 16} ${pts.join(" ")} ${w},${h - 16}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full text-hue-azure">
      <polyline fill="currentColor" fillOpacity="0.12" stroke="none" points={area} />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

function Bars({ rows, empty }: { rows: CountRow[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="px-3 py-6 text-xs text-fg-subtle">{empty}</p>;
  return (
    <ul className="space-y-1 p-3">
      {rows.slice(0, 8).map((r) => (
        <li key={r.name} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1.5 text-xs">
          <span
            className="absolute inset-y-0 left-0 bg-current/10"
            style={{ width: `${(r.value / max) * 100}%` }}
          />
          <span className="relative min-w-0 truncate">{r.name}</span>
          <span className="relative tabular text-fg-muted">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function CardTabs({
  tabs,
  empty,
}: {
  tabs: { id: string; label: string; rows: CountRow[] }[];
  empty: string;
}) {
  const [id, setId] = useState(tabs[0]?.id || "");
  const cur = tabs.find((t) => t.id === id) || tabs[0];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-elevated">
      <div className="flex flex-wrap gap-1 border-b border-border px-2 pt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "border-b-2 px-2.5 py-1.5 text-xs font-medium",
              t.id === cur?.id ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
            onClick={() => setId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {cur && <Bars rows={cur.rows} empty={empty} />}
    </div>
  );
}

export function AnalyticsPanel({
  kind,
  id,
  tenantId,
  title,
  description,
  onClose,
}: {
  kind: "short" | "link";
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  onClose: () => void;
}) {
  const t = useT();
  const [range, setRange] = useState<(typeof RANGES)[number]>("24h");
  const [stats, setStats] = useState<AnalyticsBundle | null>(null);
  const [eventsOpen, setEventsOpen] = useState(false);

  useEffect(() => {
    setStats(null);
    const req =
      kind === "short"
        ? getShortAnalytics({ data: { id, tenant_id: tenantId, range } })
        : getLinkAnalytics({ data: { link_id: id, tenant_id: tenantId, range } });
    void req.then(setStats).catch(() => setStats(null));
  }, [kind, id, tenantId, range]);

  const clicks = stats?.human ?? 0;

  const geo = useMemo(
    () =>
      stats
        ? [
            { id: "countries", label: t("analytics.countries"), rows: stats.countries },
            { id: "continents", label: t("analytics.continents"), rows: stats.continents },
            { id: "cities", label: t("analytics.cities"), rows: [] },
            { id: "regions", label: t("analytics.regions"), rows: [] },
          ]
        : [],
    [stats, t],
  );
  const devices = useMemo(
    () =>
      stats
        ? [
            { id: "devices", label: t("analytics.devices"), rows: stats.devices },
            { id: "browsers", label: t("analytics.browsers"), rows: stats.browsers },
            { id: "os", label: t("analytics.os"), rows: stats.os },
            { id: "triggers", label: t("analytics.triggers"), rows: stats.triggers },
          ]
        : [],
    [stats, t],
  );
  const links = useMemo(
    () =>
      stats
        ? [
            { id: "links", label: t("analytics.links"), rows: stats.links },
            { id: "dest", label: t("analytics.dest"), rows: stats.destinations },
          ]
        : [],
    [stats, t],
  );
  const refs = useMemo(
    () =>
      stats
        ? [
            { id: "ref", label: t("analytics.referrers"), rows: stats.referrers },
            { id: "utm", label: t("analytics.utm"), rows: stats.utm },
          ]
        : [],
    [stats, t],
  );

  return (
    <FullScreenModal title={t("analytics.title")} description={description || title} onClose={onClose} xl>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-border bg-bg px-2 text-xs"
          value={range}
          onChange={(e) => setRange(e.target.value as (typeof RANGES)[number])}
        >
          {RANGES.map((r) => (
            <option key={r} value={r}>
              {t(`analytics.range.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-bg-elevated">
        <div className="flex items-end justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <MousePointerClick className="h-3.5 w-3.5 text-hue-azure" />
              {t("analytics.clicks")}
            </p>
            <p className="font-display text-3xl font-semibold tabular">{stats ? clicks : "…"}</p>
          </div>
          {stats && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs hover:bg-bg-subtle"
                onClick={() => setEventsOpen((v) => !v)}
              >
                <List className="h-3.5 w-3.5" />
                {t("analytics.viewEvents")}
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs hover:bg-bg-subtle"
                onClick={() => downloadCsv(stats, title)}
              >
                <Download className="h-3.5 w-3.5" />
                {t("analytics.exportCsv")}
              </button>
            </div>
          )}
        </div>
        {stats ? <Chart series={stats.series} /> : <div className="h-44" />}
      </div>
      {stats && (
        <div className="grid gap-3 lg:grid-cols-2">
          <CardTabs tabs={links} empty={t("analytics.empty")} />
          <CardTabs tabs={refs} empty={t("analytics.empty")} />
          <CardTabs tabs={geo} empty={t("analytics.empty")} />
          <CardTabs tabs={devices} empty={t("analytics.empty")} />
        </div>
      )}
      {stats && eventsOpen && (
        <div className="overflow-hidden rounded-xl border border-border">
          <p className="border-b border-border px-3 py-2 text-xs font-medium">{t("analytics.events")}</p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="sticky top-0 bg-bg-elevated text-fg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("analytics.colTime")}</th>
                  <th className="px-3 py-2 font-medium">{t("analytics.colTrigger")}</th>
                  <th className="px-3 py-2 font-medium">{t("analytics.colCountry")}</th>
                  <th className="px-3 py-2 font-medium">{t("analytics.colDevice")}</th>
                  <th className="px-3 py-2 font-medium">{t("analytics.colOs")}</th>
                  <th className="px-3 py-2 font-medium">{t("analytics.colBrowser")}</th>
                  <th className="px-3 py-2 font-medium">{t("analytics.colReferrer")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.events.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-fg-subtle" colSpan={7}>
                      {t("analytics.empty")}
                    </td>
                  </tr>
                )}
                {stats.events.map((e, i) => (
                  <tr key={`${e.created_at}-${i}`} className="border-t border-border/70">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular text-fg-muted">
                      {e.created_at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-1.5">
                      {e.trigger === "qr" ? t("analytics.triggerQr") : t("analytics.triggerLink")}
                    </td>
                    <td className="px-3 py-1.5">{e.country || "—"}</td>
                    <td className="px-3 py-1.5">{e.device || "—"}</td>
                    <td className="px-3 py-1.5">{e.os || "—"}</td>
                    <td className="px-3 py-1.5">{e.browser || "—"}</td>
                    <td className="max-w-[12rem] truncate px-3 py-1.5">{e.referrer || "(direct)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FullScreenModal>
  );
}
