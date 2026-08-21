import { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import {
  SHORT_CSV_HEADERS,
  SKIP_DOMAIN_DEFAULT,
  csvRowToShort,
  downloadCsv,
  groupCsvByDomain,
  orphanCsvRows,
  parseCsv,
  toCsv,
  type CsvDomainGroup,
  type CsvShortRow,
} from "@/lib/csv";
import { addTenantDomain, lookupDomainHosts } from "@/lib/docbay/api";
import { importShorts } from "@/lib/docbay/shorts-api";
import type { FullState, ShortLink, TenantDomain, WorkspaceSummary } from "@/lib/docbay/types";
import { useT } from "@/lib/i18n";

export function exportShortsCsv(shorts: ShortLink[], host: string) {
  const csv = toCsv(
    [...SHORT_CSV_HEADERS],
    shorts.map((s) => [
      s.destination,
      s.slug,
      s.title,
      s.note,
      s.tags.join(","),
      s.utm_source,
      s.utm_medium,
      s.utm_campaign,
      s.utm_term,
      s.utm_content,
      s.ios_url,
      s.android_url,
      s.cloak ? "true" : "false",
      s.expires_at,
      s.human_click_count || s.click_count,
      s.created_at,
      `https://${host}/${s.slug}`,
    ]),
    ";",
  );
  downloadCsv(`bestl-links-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

type DomainPick = {
  host: string;
  on: boolean;
  tenantId: string;
  existing?: { tenant_id: string; tenant_name: string };
};

function guessTenant(spaces: string[], workspaces: WorkspaceSummary[], fallback: string): string {
  for (const space of spaces) {
    const n = space.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!n || n === "none" || n === "single") continue;
    const hit = workspaces.find((w) => {
      const wn = w.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return wn && (wn.includes(n) || n.includes(wn) || w.subdomain.replace(/[^a-z0-9]+/g, "") === n);
    });
    if (hit) return hit.id;
  }
  return fallback;
}

export function CsvImportButton({
  tenantId,
  workspaces,
  domains,
  onImported,
}: {
  tenantId: string;
  workspaces: WorkspaceSummary[];
  domains: TenantDomain[];
  onImported: (shorts: ShortLink[], extra?: { domains?: TenantDomain[] }) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvShortRow[]>([]);
  const [groups, setGroups] = useState<CsvDomainGroup[]>([]);
  const [orphans, setOrphans] = useState<CsvShortRow[]>([]);
  const [picks, setPicks] = useState<DomainPick[]>([]);
  const [importOrphans, setImportOrphans] = useState(true);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: number;
    domains: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  const selectedCount = useMemo(() => {
    const set = new Set(picks.filter((p) => p.on).map((p) => p.host));
    let n = groups.filter((g) => set.has(g.host)).reduce((a, g) => a + g.rows.length, 0);
    if (importOrphans) n += orphans.length;
    return n;
  }, [picks, groups, orphans, importOrphans]);

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        const parsed = parseCsv(String(reader.result || ""));
        const next: CsvShortRow[] = [];
        let miss = 0;
        for (const r of parsed.rows) {
          const row = csvRowToShort(r);
          if (!row) {
            miss++;
            continue;
          }
          next.push(row);
        }
        const grouped = groupCsvByDomain(next);
        const rest = orphanCsvRows(next);
        let hits: { host: string; tenant_id: string; tenant_name: string }[] = [];
        try {
          hits = (await lookupDomainHosts({ data: { hosts: grouped.map((g) => g.host) } })).hits;
        } catch {
          hits = [];
        }
        const byHost = new Map(hits.map((h) => [h.host, h]));
        const local = new Map(domains.map((d) => [d.host.toLowerCase(), d]));
        setRows(next);
        setGroups(grouped);
        setOrphans(rest);
        setSkipped(miss);
        setResult(null);
        setImportOrphans(rest.length > 0);
        setPicks(
          grouped.map((g) => {
            const existing = byHost.get(g.host);
            const onLocal = local.has(g.host);
            const tenant =
              existing?.tenant_id ||
              guessTenant(g.spaces, workspaces, tenantId);
            return {
              host: g.host,
              on: !SKIP_DOMAIN_DEFAULT.has(g.host) || onLocal || Boolean(existing),
              tenantId: tenant,
              existing: existing
                ? { tenant_id: existing.tenant_id, tenant_name: existing.tenant_name }
                : onLocal
                  ? { tenant_id: tenantId, tenant_name: workspaces.find((w) => w.id === tenantId)?.name || "" }
                  : undefined,
            };
          }),
        );
        setOpen(true);
      })();
    };
    reader.readAsText(file);
  }

  async function run() {
    if (!selectedCount) return;
    setBusy(true);
    try {
      const mine: ShortLink[] = [];
      const errors: { row: number; message: string }[] = [];
      let domainsMade = 0;
      let okAll = 0;
      const newDomains: TenantDomain[] = [];
      for (const pick of picks.filter((p) => p.on)) {
        const group = groups.find((g) => g.host === pick.host);
        if (!group) continue;
        const existsHere =
          pick.existing?.tenant_id === pick.tenantId ||
          (pick.tenantId === tenantId && domains.some((d) => d.host.toLowerCase() === pick.host));
        if (!existsHere) {
          try {
            const s = (await addTenantDomain({
              data: { host: pick.host, tenant_id: pick.tenantId },
            })) as FullState;
            domainsMade++;
            if (pick.tenantId === tenantId) {
              const added = s.domains?.find((d) => d.host === pick.host);
              if (added) newDomains.push(added);
            }
          } catch (e) {
            errors.push({
              row: 0,
              message: `${pick.host}: ${e instanceof Error ? e.message : "Domain fehlgeschlagen"}`,
            });
            continue;
          }
        }
        const res = await importShorts({
          data: { tenant_id: pick.tenantId, rows: group.rows },
        });
        okAll += res.created.length;
        mine.push(...res.created.filter((s) => s.tenant_id === tenantId || pick.tenantId === tenantId));
        errors.push(...res.errors);
      }
      if (importOrphans && orphans.length) {
        const res = await importShorts({
          data: { tenant_id: tenantId, rows: orphans },
        });
        okAll += res.created.length;
        mine.push(...res.created);
        errors.push(...res.errors);
      }
      onImported(mine, { domains: newDomains });
      setResult({ ok: okAll, domains: domainsMade, errors });
      if (okAll || domainsMade) {
        toast.success(
          t("csv.imported", { n: String(okAll) }) +
            (domainsMade ? ` · ${t("csv.domainsAdded", { n: String(domainsMade) })}` : ""),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-fg-muted hover:bg-bg-subtle hover:text-fg">
        <Upload className="h-3.5 w-3.5" />
        {t("csv.import")}
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            onFile(f);
          }}
        />
      </label>
      {open && (
        <FullScreenModal
          title={t("csv.importTitle")}
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              {!result && (
                <Button type="button" disabled={busy || !selectedCount} onClick={() => void run()}>
                  {busy ? t("common.loading") : t("csv.run", { n: String(selectedCount) })}
                </Button>
              )}
            </>
          }
        >
          <p className="text-sm text-fg-muted">{t("csv.hintFoxly")}</p>
          <p className="mt-2 text-sm">
            {t("csv.ready", { n: String(rows.length) })}
            {skipped > 0 ? ` · ${t("csv.skipped", { n: String(skipped) })}` : ""}
          </p>

          {groups.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-fg-muted">{t("csv.domains")}</p>
                <button
                  type="button"
                  className="text-[11px] text-fg-muted hover:text-fg"
                  onClick={() => {
                    const allOn = picks.every((p) => p.on);
                    setPicks((prev) => prev.map((p) => ({ ...p, on: !allOn })));
                  }}
                >
                  {t("csv.toggleAll")}
                </button>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {picks.map((p) => {
                  const g = groups.find((x) => x.host === p.host);
                  const samples = (g?.rows || [])
                    .slice(0, 3)
                    .map((r) => r.slug)
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <li key={p.host} className="flex flex-col gap-2 px-3 py-2.5 @min-[36rem]/modal:flex-row @min-[36rem]/modal:items-center">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={p.on}
                          onChange={(e) =>
                            setPicks((prev) =>
                              prev.map((x) => (x.host === p.host ? { ...x, on: e.target.checked } : x)),
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-sm">{p.host}</span>
                          <span className="block text-[11px] text-fg-subtle">
                            {t("csv.linkCount", { n: String(g?.rows.length ?? 0) })}
                            {samples ? ` · ${samples}` : ""}
                            {g?.spaces.length ? ` · ${g.spaces.join(", ")}` : ""}
                          </span>
                          {p.existing && (
                            <span className="mt-0.5 block text-[11px] text-fg-muted">
                              {t("csv.alreadyIn", { name: p.existing.tenant_name || p.existing.tenant_id })}
                            </span>
                          )}
                        </span>
                      </label>
                      <select
                        className="h-9 w-full shrink-0 rounded-md border border-border bg-bg px-2 text-xs @min-[36rem]/modal:w-52"
                        disabled={!p.on}
                        value={p.tenantId}
                        onChange={(e) =>
                          setPicks((prev) =>
                            prev.map((x) => (x.host === p.host ? { ...x, tenantId: e.target.value } : x)),
                          )
                        }
                      >
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {orphans.length > 0 && (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={importOrphans}
                onChange={(e) => setImportOrphans(e.target.checked)}
              />
              {t("csv.orphans", { n: String(orphans.length) })}
            </label>
          )}

          {result && (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                {t("csv.done", { n: String(result.ok) })}
                {result.domains ? ` · ${t("csv.domainsAdded", { n: String(result.domains) })}` : ""}
              </p>
              {result.errors.slice(0, 24).map((e) => (
                <p key={`${e.row}-${e.message}`} className="text-xs text-fg-muted">
                  {e.row ? t("csv.rowErr", { row: String(e.row), msg: e.message }) : e.message}
                </p>
              ))}
            </div>
          )}
          <button
            type="button"
            className="mt-4 text-xs text-fg-muted underline hover:text-fg"
            onClick={() =>
              downloadCsv(
                "bestl-links-vorlage.csv",
                toCsv([...SHORT_CSV_HEADERS], [["https://beispiel.de", "angebot", "Beispiel", "", "kampagne"]], ";"),
              )
            }
          >
            {t("csv.template")}
          </button>
        </FullScreenModal>
      )}
    </>
  );
}

export function mergeImported(
  state: FullState,
  shorts: ShortLink[],
  extra?: { domains?: TenantDomain[] },
): FullState {
  const seen = new Set(shorts.map((s) => s.id));
  const nextShorts = shorts.length
    ? [...shorts, ...state.shorts.filter((s) => !seen.has(s.id))]
    : state.shorts;
  let domains = state.domains;
  if (extra?.domains?.length) {
    const have = new Set(domains.map((d) => d.id));
    domains = [...domains, ...extra.domains.filter((d) => !have.has(d.id))];
  }
  return {
    ...state,
    shorts: nextShorts,
    domains,
    stats: { ...state.stats, shorts: nextShorts.length },
  };
}
