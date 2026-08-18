import { useEffect, useRef, useState } from "react";
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
  const idx = Math.max(0, CREATE_KINDS.findIndex((k) => k.id === value));
  const n = CREATE_KINDS.length;
  const active = CREATE_KINDS[idx]!;
  const prev = useRef(idx);
  const [stretch, setStretch] = useState(1);
  const [from, setFrom] = useState(idx);

  useEffect(() => {
    const dist = idx - prev.current;
    const last = prev.current;
    prev.current = idx;
    if (!dist) return;
    setFrom(last);
    setStretch(1 + Math.min(Math.abs(dist), 4) * 0.18);
    const id = window.setTimeout(() => setStretch(1), 360);
    return () => window.clearTimeout(id);
  }, [idx]);

  return (
    <div
      role="tablist"
      aria-label={t("create.url")}
      className="relative flex h-9 w-[11.5rem] shrink-0 items-stretch rounded-lg bg-bg-subtle p-0.5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-md hue-action hue-warp shadow-sm"
        style={{
          width: `calc((100% - 4px) / ${n})`,
          left: `calc(2px + ${idx} * ((100% - 4px) / ${n}))`,
          transform: `scaleX(${stretch})`,
          transformOrigin: idx > from ? "left center" : idx < from ? "right center" : "center",
          transition:
            "left 540ms cubic-bezier(0.22, 1.4, 0.36, 1), transform 360ms cubic-bezier(0.22, 1.15, 0.36, 1)",
          ...hueStyle(active.hue),
        }}
      />
      {CREATE_KINDS.map((k) => {
        const Icon = k.icon;
        const on = value === k.id;
        return (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={on}
            title={t(k.labelKey)}
            onClick={() => onChange(k.id)}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center rounded-md transition-colors duration-500 ease-out",
              on ? "text-white" : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
