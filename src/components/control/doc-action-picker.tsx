import { DOC_ACTION_IDS, type DocAction, type DocActionId } from "@/lib/docbay/doc-actions";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const needsTarget: DocActionId[] = ["call", "email"];

export function DocActionPicker({
  value,
  onChange,
}: {
  value: DocAction[];
  onChange: (next: DocAction[]) => void;
}) {
  const t = useT();
  const labels: Record<DocActionId, string> = {
    accept: t("doc.actAccept"),
    reject: t("doc.actReject"),
    sign: t("doc.actSign"),
    call: t("doc.actCall"),
    email: t("doc.actEmail"),
  };

  function toggle(id: DocActionId) {
    const has = value.some((a) => a.id === id);
    if (has) {
      onChange(value.filter((a) => a.id !== id));
      return;
    }
    if (value.length >= 3) return;
    onChange([...value, { id, target: "" }]);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-fg-muted">{t("doc.actionsHint")}</p>
      <div className="flex flex-wrap gap-1.5">
        {DOC_ACTION_IDS.map((id) => {
          const on = value.some((a) => a.id === id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs",
                on
                  ? "border-fg/30 bg-bg-muted text-fg"
                  : "border-border text-fg-muted hover:text-fg",
                !on && value.length >= 3 && "opacity-40",
              )}
            >
              {labels[id]}
            </button>
          );
        })}
      </div>
      {value
        .filter((a) => needsTarget.includes(a.id))
        .map((a) => (
          <div key={a.id}>
            <Input
              value={a.target}
              placeholder={a.id === "call" ? t("doc.phonePh") : t("doc.emailPh")}
              onChange={(e) =>
                onChange(value.map((x) => (x.id === a.id ? { ...x, target: e.target.value } : x)))
              }
            />
          </div>
        ))}
    </div>
  );
}
