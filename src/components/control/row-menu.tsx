import { useState, type ReactNode } from "react";
import { MoreVertical, type LucideIcon } from "lucide-react";
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
  if (items.length === 0) return null;
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 px-0"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Schließen"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded-md border border-border bg-bg-elevated p-1 shadow-lg">
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
        </>
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
    <span className="hidden tabular text-xs text-fg-subtle @min-[40rem]/hub:inline">
      {clicks}
      {at ? ` · ${lastLabel} ${at}` : ""}
      {extra}
    </span>
  );
}