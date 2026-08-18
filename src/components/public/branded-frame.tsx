import { useEffect } from "react";
import { Shield } from "lucide-react";
import { BRAND_HOME, BRAND_NAME } from "@/lib/docbay/brand";
import { useT } from "@/lib/i18n";

export function BrandFlag({ dest }: { dest?: string }) {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center">
      <a
        href={BRAND_HOME}
        target="_blank"
        rel="noreferrer"
        className="pointer-events-auto flex h-9 items-center gap-2 rounded-t-md border border-b-0 border-border bg-bg-elevated px-3 text-xs leading-none text-fg-muted shadow-md transition-colors hover:bg-bg-subtle hover:text-fg"
      >
        <span className="metal flex h-5 w-5 items-center justify-center rounded-sm">
          <Shield className="h-3 w-3" strokeWidth={2.2} />
        </span>
        <span className="whitespace-nowrap">
          {t("brand.flag", { name: BRAND_NAME })}
        </span>
      </a>
      {dest ? <span className="sr-only">{dest}</span> : null}
    </div>
  );
}

export function BrandedFrame({
  url,
  title,
}: {
  url: string;
  title?: string;
  showFlag?: boolean;
  frameable?: boolean;
}) {
  const t = useT();
  useEffect(() => {
    const tmr = window.setTimeout(() => {
      window.location.replace(url);
    }, 1450);
    return () => window.clearTimeout(tmr);
  }, [url]);

  let host = url;
  try {
    host = new URL(url, "https://bestl.ink").host;
  } catch {
    /* keep raw */
  }

  return (
    <div className="hop-wash relative flex min-h-dvh flex-col items-center justify-center px-6">
      <a
        href={BRAND_HOME}
        target="_blank"
        rel="noreferrer"
        className="badge-shine metal inline-flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium shadow-lg"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/15">
          <Shield className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span>{t("brand.flag", { name: BRAND_NAME })}</span>
      </a>
      {title ? (
        <p className="mt-5 max-w-md truncate text-center text-sm text-white/75">{title}</p>
      ) : null}
      <a
        href={url}
        className="mt-3 text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
      >
        {host}
      </a>
    </div>
  );
}
