import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, MousePointerClick, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function RowMenu({
  items,
}: {
  items: {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    danger?: boolean;
    kbd?: string;
    sep?: boolean;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = items.length * 36 + 16;
    const openUp = r.bottom + menuH > window.innerHeight - 8;
    setPos({
      top: openUp ? r.top - menuH - 4 : r.bottom + 4,
      left: Math.max(8, r.right - 220),
    });
  }, [open, items.length]);

  if (items.length === 0) return null;
  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-fg-muted hover:bg-bg-subtle hover:text-fg"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Schließen"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-50 min-w-[13.5rem] rounded-xl border border-border bg-bg-elevated p-1 shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.label}>
                    {item.sep && i > 0 && <div className="my-1 border-t border-border" />}
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-bg-subtle",
                        i === 0 && "ring-1 ring-inset ring-hue-azure/70",
                        item.danger ? "text-danger" : "text-fg",
                      )}
                      onClick={() => {
                        setOpen(false);
                        item.onClick();
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="flex-1">{item.label}</span>
                      {item.kbd && (
                        <kbd
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                            item.danger
                              ? "border-danger/30 bg-danger/10 text-danger"
                              : "border-border bg-bg-subtle text-fg-muted",
                          )}
                        >
                          {item.kbd}
                        </kbd>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function ClicksChip({
  clicks,
  onClick,
  label,
}: {
  clicks: number;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-bg px-2.5 text-xs font-medium text-fg hover:bg-bg-subtle"
    >
      <MousePointerClick className="h-3.5 w-3.5 text-hue-azure" />
      {label.replace("{n}", String(clicks))}
    </button>
  );
}

export function VisitMeta({
  clicks,
  at,
  lastLabel,
  extra,
}: {
  clicks: number;
  at?: string | null;
  lastLabel: string;
  extra?: ReactNode;
}) {
  return (
    <span className="hidden items-center gap-1 tabular text-xs text-fg-subtle @min-[40rem]/hub:inline-flex">
      <MousePointerClick className="h-3.5 w-3.5" />
      {clicks}
      {at ? ` · ${lastLabel} ${at}` : ""}
      {extra}
    </span>
  );
}
