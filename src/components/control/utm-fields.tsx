import { Plus, Trash2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { emptyUtmRows, UTM_STD, type UtmRow } from "@/lib/docbay/utm";

export function UtmFields({
  value,
  onChange,
}: {
  value: UtmRow[];
  onChange: (next: UtmRow[]) => void;
}) {
  const t = useT();
  const rows = value.length ? value : emptyUtmRows();
  const stdKeys = new Set(UTM_STD.map((k) => k.key));

  function labelFor(key: string) {
    const hit = UTM_STD.find((k) => k.key === key);
    return hit ? t(hit.labelKey) : key;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const std = stdKeys.has(row.key);
        return (
          <div key={row.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              {std ? (
                <Label>{labelFor(row.key)}</Label>
              ) : (
                <input
                  className="h-7 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-[11px] outline-none"
                  value={row.key}
                  placeholder={t("short.utmKey")}
                  onChange={(e) =>
                    onChange(rows.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r)))
                  }
                />
              )}
              {!std && (
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
            <Input
              value={row.value}
              onChange={(e) =>
                onChange(rows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)))
              }
              placeholder={row.key}
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...rows,
            { id: Math.random().toString(36).slice(2, 9), key: "utm_", value: "" },
          ])
        }
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("short.utmAdd")}
      </button>
    </div>
  );
}
