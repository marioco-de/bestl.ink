import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FullScreenModal({
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="@container/fs fixed inset-0 z-50 flex items-stretch justify-center @min-[640px]/fs:items-center @min-[640px]/fs:p-4"
    >
      <button
        type="button"
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative flex h-dvh w-full flex-col bg-bg @min-[640px]/fs:h-[min(90dvh,800px)] @min-[640px]/fs:max-w-lg @min-[640px]/fs:rounded-xl @min-[640px]/fs:border @min-[640px]/fs:border-border @min-[640px]/fs:shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-fg-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-subtle hover:text-fg"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className={cn("mx-auto w-full space-y-4", className)}>
            {children}
          </div>
        </div>
        {footer && (
          <footer className="shrink-0 border-t border-border bg-bg-elevated px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex w-full flex-col-reverse gap-2 @min-[400px]/fs:flex-row @min-[400px]/fs:justify-end">
              {footer}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
