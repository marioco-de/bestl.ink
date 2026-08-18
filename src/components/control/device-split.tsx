import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import {
  applyTarget,
  emptySplitRule,
  SPLIT_COUNTRIES,
  SPLIT_TARGETS,
  targetKey,
  type SplitRule,
} from "@/lib/docbay/device-split";

export function DeviceSplitFields({
  value,
  onChange,
}: {
  value: SplitRule[];
  onChange: (next: SplitRule[]) => void;
}) {
  const t = useT();
  const rows = value.length ? value : [emptySplitRule()];

  function patch(id: string, next: SplitRule) {
    onChange(rows.map((r) => (r.id === id ? next : r)));
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">{t("short.deviceAt")}</p>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg"
                aria-label={t("common.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 min-w-[9.5rem] rounded-md border border-border bg-bg px-2 text-sm"
              value={targetKey(row)}
              onChange={(e) => patch(row.id, applyTarget(row, e.target.value))}
            >
              {SPLIT_TARGETS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            {row.kind === "country" && (
              <select
                className="h-9 w-[5.5rem] rounded-md border border-border bg-bg px-2 text-sm"
                value={row.match || "DE"}
                onChange={(e) => patch(row.id, { ...row, match: e.target.value })}
              >
                {SPLIT_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Input
            value={row.url}
            onChange={(e) => patch(row.id, { ...row, url: e.target.value })}
            placeholder="https://"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, emptySplitRule()])}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("short.deviceAdd")}
      </button>
    </div>
  );
}
