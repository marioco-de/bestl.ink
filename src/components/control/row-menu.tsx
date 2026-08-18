import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, MousePointerClick, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RowMenu({
  items,
}: {
  items: {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    danger?: boolean;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = items.length * 32 + 12;
    const openUp = r.bottom + menuH > window.innerHeight - 8;
    setPos({
      top: openUp ? r.top - menuH - 4 : r.bottom + 4,
      left: Math.max(8, r.right - 160),
    });
  }, [open, items.length]);

  if (items.length === 0) return null;
  return (
    <div className="relative">
      <Button
        ref={btnRef}
        size="sm"
        variant="ghost"
        className="h-8 w-8 px-0"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
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
              className="fixed z-50 min-w-[10rem] rounded-md border border-border bg-bg-elevated p-1 shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-bg-subtle",
                      item.danger ? "text-danger" : "text-fg",
                    )}
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </div>
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