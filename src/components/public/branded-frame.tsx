import { useEffect } from "react";
import { BRAND_NAME } from "@/lib/docbay/brand";

const HOME = "https://www.bestl.ink";

function Flag({ dest }: { dest?: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center">
      <a
        href={HOME}
        target="_blank"
        rel="noreferrer"
        className="pointer-events-auto flex h-8 items-center gap-2 rounded-t-md border border-b-0 border-border bg-bg-elevated px-2.5 text-[11px] leading-none text-fg-muted shadow-md transition-colors hover:bg-bg-subtle hover:text-fg"
      >
        <span className="metal flex h-4 w-4 items-center justify-center rounded-sm font-display text-[8px] font-semibold text-primary-fg">
          bl
        </span>
        <span className="whitespace-nowrap">
          shortened & secured with{" "}
          <span className="font-medium text-fg">{BRAND_NAME}</span>
        </span>
      </a>
      {dest ? (
        <span className="sr-only">{dest}</span>
      ) : null}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function BrandedFrame({
  url,
  title,
  showFlag = true,
  frameable = false,
}: {
  url: string;
  title?: string;
  showFlag?: boolean;
  frameable?: boolean;
}) {
  const canFrame = Boolean(frameable);

  useEffect(() => {
    if (canFrame) return;
    const t = window.setTimeout(() => {
      window.location.replace(url);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [canFrame, url]);

  if (canFrame) {
    return (
      <div className="relative h-dvh w-full overflow-hidden bg-bg">
        <iframe
          title={title || "link"}
          src={url}
          className="h-full w-full border-0 bg-bg"
          referrerPolicy="no-referrer"
        />
        {showFlag && <Flag dest={url} />}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-bg px-6">
      <p className="text-[11px] uppercase tracking-wider text-fg-subtle">
        Weiterleitung
      </p>
      <p className="mt-2 max-w-md truncate text-center font-display text-lg font-semibold">
        {title || hostOf(url)}
      </p>
      <p className="mt-1 font-mono text-xs text-fg-muted">{hostOf(url)}</p>
      <a
        href={url}
        className="mt-6 text-sm text-primary underline-offset-2 hover:underline"
      >
        Weiter zur Seite
      </a>
      {showFlag && <Flag dest={url} />}
    </div>
  );
}
