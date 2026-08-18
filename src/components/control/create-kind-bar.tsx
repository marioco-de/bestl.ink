import { CREATE_KINDS, type CreateKind } from "@/lib/docbay/create-kind";
import { hueStyle } from "@/lib/docbay/palette";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function CreateKindBar({
  value,
  onChange,
}: {
  value: CreateKind;
  onChange: (k: CreateKind) => void;
}) {
  const t = useT();
  return (
    <div className="mb-4 flex flex-wrap justify-center gap-1">
      {CREATE_KINDS.map((k) => {
        const Icon = k.icon;
        const on = value === k.id;
        return (
          <button
            key={k.id}
            type="button"
            title={t(k.labelKey)}
            onClick={() => onChange(k.id)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
              on ? "hue-action border-transparent text-white" : "border-border text-fg-muted hover:bg-bg-subtle",
            )}
            style={on ? hueStyle(k.hue) : undefined}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}