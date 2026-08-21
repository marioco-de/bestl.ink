import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import {
  SHORT_CSV_HEADERS,
  csvRowToShort,
  downloadCsv,
  parseCsv,
  toCsv,
  type CsvShortRow,
} from "@/lib/csv";
import { importShorts } from "@/lib/docbay/shorts-api";
import type { FullState, ShortLink } from "@/lib/docbay/types";
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

export function CsvImportButton({
  tenantId,
  onImported,
}: {
  tenantId: string;
  onImported: (shorts: ShortLink[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvShortRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; errors: { row: number; message: string }[] } | null>(
    null,
  );

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
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
      setRows(next);
      setSkipped(miss);
      setResult(null);
      setOpen(true);
    };
    reader.readAsText(file);
  }

  async function run() {
    if (!rows.length) return;
    setBusy(true);
    try {
      const res = await importShorts({ data: { tenant_id: tenantId, rows } });
      onImported(res.created);
      setResult({ ok: res.created.length, errors: res.errors });
      if (res.created.length) toast.success(t("csv.imported", { n: String(res.created.length) }));
      if (res.truncated) toast.message(t("csv.truncated"));
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
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              {!result && (
                <Button type="button" disabled={busy || !rows.length} onClick={() => void run()}>
                  {busy ? t("common.loading") : t("csv.run", { n: String(rows.length) })}
                </Button>
              )}
            </>
          }
        >
          <p className="text-sm text-fg-muted">{t("csv.hint")}</p>
          <p className="mt-3 text-sm">
            {t("csv.ready", { n: String(rows.length) })}
            {skipped > 0 ? ` · ${t("csv.skipped", { n: String(skipped) })}` : ""}
          </p>
          {result && (
            <div className="mt-4 space-y-2 text-sm">
              <p>{t("csv.done", { n: String(result.ok) })}</p>
              {result.errors.slice(0, 20).map((e) => (
                <p key={`${e.row}-${e.message}`} className="text-xs text-fg-muted">
                  {t("csv.rowErr", { row: String(e.row), msg: e.message })}
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

export function mergeImported(state: FullState, shorts: ShortLink[]): FullState {
  if (!shorts.length) return state;
  const seen = new Set(shorts.map((s) => s.id));
  const next = [...shorts, ...state.shorts.filter((s) => !seen.has(s.id))];
  return {
    ...state,
    shorts: next,
    stats: { ...state.stats, shorts: next.length },
  };
}
