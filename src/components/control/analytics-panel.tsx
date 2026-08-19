import { useEffect, useMemo, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import type { AnalyticsBundle, CountRow } from "@/lib/docbay/analytics";
import { getShortAnalytics } from "@/lib/docbay/shorts-api";
import { getLinkAnalytics } from "@/lib/docbay/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const RANGES = ["24h", "7d", "30d"] as const;

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
            { id: "triggers", label: t("analytics.triggers"), rows: [] },
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
    </FullScreenModal>
  );
}
