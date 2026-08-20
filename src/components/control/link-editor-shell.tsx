import { useState, type ReactNode } from "react";
import { ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";
import { QrDrawer } from "./qr-drawer";
import { useT } from "@/lib/i18n";

export function DashPinBlock({
  pin,
  onPin,
  display,
  onDisplay,
}: {
  pin: boolean;
  onPin: (v: boolean) => void;
  display: "text" | "icon" | "preview";
  onDisplay: (v: "text" | "icon" | "preview") => void;
}) {
  const t = useT();
  return (
    <section className="space-y-2 rounded-md border border-border p-3">
      <Toggle label={t("dash.pin")} checked={pin} onChange={onPin} />
      {pin && (
        <select
          className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
          value={display}
          onChange={(e) => onDisplay(e.target.value as "text" | "icon" | "preview")}
        >
          <option value="text">{t("dash.asText")}</option>
          <option value="icon">{t("dash.asIcon")}</option>
          <option value="preview">{t("dash.asPreview")}</option>
        </select>
      )}
    </section>
  );
}

export function LinkEditorShell({
  title,
  description,
  onClose,
  toolbar,
  footer,
  children,
  url,
  slug,
  preview,
  created = true,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  url: string;
  slug: string;
  preview: { title: string; text: string; image: string; host: string };
  created?: boolean;
}) {
  const t = useT();
  return (
    <div className="@container/stage fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full items-center justify-center p-0 @min-[40rem]/stage:p-6 @min-[40rem]/stage:px-14">
        <div className="relative flex h-full w-full max-w-none @min-[40rem]/stage:h-auto @min-[40rem]/stage:max-h-[min(88dvh,720px)] @min-[40rem]/stage:max-w-[34rem]">
          <OgPreviewDrawer preview={preview} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="@container/modal relative z-20 flex h-full min-w-0 w-full flex-col overflow-hidden bg-bg-elevated shadow-2xl @min-[40rem]/stage:h-auto @min-[40rem]/stage:max-h-[min(88dvh,720px)] @min-[40rem]/stage:rounded-xl @min-[40rem]/stage:border @min-[40rem]/stage:border-border"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
              </div>
              {toolbar}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg"
                aria-label="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto snap-y snap-mandatory @min-[40rem]/stage:snap-none">
              <div className="flex min-h-full snap-end flex-col @min-[40rem]/stage:min-h-0 @min-[40rem]/stage:snap-align-none">
                <div className="min-h-0 flex-1 px-4 py-5">
                  <div className="space-y-6">{children}</div>
                </div>
                {footer && (
                  <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-bg-elevated px-3 py-3 @min-[28rem]/modal:flex-row @min-[28rem]/modal:items-center @min-[28rem]/modal:justify-between">
                    {footer}
                  </footer>
                )}
                <p className="shrink-0 bg-bg-elevated pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 text-center text-[11px] text-fg-subtle @min-[40rem]/stage:hidden">
                  {t("create.scrollPreview")}
                </p>
              </div>
              <div className="snap-start space-y-4 px-4 py-6 @min-[40rem]/stage:hidden">
                <OgPreviewCard preview={preview} />
                {created && <QrDrawer url={url} slug={slug} variant="inline" />}
              </div>
            </div>
          </div>
          <QrDrawer url={url} slug={slug} variant="desktop" />
        </div>
      </div>
    </div>
  );
}

function OgPreviewCard({
  preview,
}: {
  preview: { title: string; text: string; image: string; host: string };
}) {
  const t = useT();
  return (
    <aside className="flex w-full flex-col gap-3 rounded-xl border border-border bg-bg p-3">
      <div>
        <p className="text-xs font-medium">{t("create.ogTitle")}</p>
        <p className="text-[11px] text-fg-subtle">{t("create.ogHint")}</p>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-bg">
        <div className="relative flex aspect-[1.91/1] items-center justify-center overflow-hidden bg-bg-subtle">
          {preview.image ? (
            <>
              <img src={preview.image} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl" />
              <img src={preview.image} alt="" className="relative z-10 h-full w-full object-contain" />
            </>
          ) : (
            <ImageIcon className="h-7 w-7 text-fg-subtle" />
          )}
        </div>
        <div className="space-y-0.5 p-2.5 text-left">
          <p className="truncate text-[10px] uppercase tracking-wide text-fg-subtle">
            {preview.host || "bestl.ink"}
          </p>
          <p className="line-clamp-2 text-sm font-semibold leading-snug">
            {preview.title || t("create.ogFallback")}
          </p>
          <p className="line-clamp-2 text-[11px] text-fg-muted">
            {preview.text || t("create.ogFallbackText")}
          </p>
        </div>
      </div>
    </aside>
  );
}

function OgPreviewDrawer({
  preview,
}: {
  preview: { title: string; text: string; image: string; host: string };
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const panel = (
    <aside className="flex w-[18rem] max-w-full flex-col gap-3 border border-l-0 border-border bg-bg-elevated p-3 shadow-xl">
      <div>
        <p className="text-xs font-medium">{t("create.ogTitle")}</p>
        <p className="text-[11px] text-fg-subtle">{t("create.ogHint")}</p>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-bg">
        <div className="relative flex aspect-[1.91/1] items-center justify-center overflow-hidden bg-bg-subtle">
          {preview.image ? (
            <>
              <img src={preview.image} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl" />
              <img src={preview.image} alt="" className="relative z-10 h-full w-full object-contain" />
            </>
          ) : (
            <ImageIcon className="h-7 w-7 text-fg-subtle" />
          )}
        </div>
        <div className="space-y-0.5 p-2.5 text-left">
          <p className="truncate text-[10px] uppercase tracking-wide text-fg-subtle">
            {preview.host || "bestl.ink"}
          </p>
          <p className="line-clamp-2 text-sm font-semibold leading-snug">
            {preview.title || t("create.ogFallback")}
          </p>
          <p className="line-clamp-2 text-[11px] text-fg-muted">
            {preview.text || t("create.ogFallbackText")}
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className="pointer-events-none absolute top-1/2 left-0 z-10 hidden -translate-y-1/2 @min-[40rem]/stage:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={cn(
          "flex items-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "-translate-x-full" : "-translate-x-8",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pointer-events-auto flex h-36 w-8 flex-col items-center justify-center gap-1.5 rounded-l-md border border-r-0 border-border bg-bg-elevated py-4 text-[10px] font-medium tracking-wide text-fg-muted shadow-sm hover:text-fg"
          aria-expanded={open}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="[writing-mode:vertical-rl]">{t("create.preview")}</span>
        </button>
        <div className={cn("pointer-events-auto", !open && "pointer-events-none")}>{panel}</div>
      </div>
    </div>
  );
}
