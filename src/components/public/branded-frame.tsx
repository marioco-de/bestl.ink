import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { BRAND_HOME, BRAND_NAME } from "@/lib/docbay/brand";
import { useT } from "@/lib/i18n";

const DELAY = 3;

export function BrandFlag({ dest }: { dest?: string }) {
  const t = useT();
  return (
    <a
      href={BRAND_HOME}
      target="_blank"
      rel="noreferrer"
      className="flex h-8 w-full shrink-0 items-center justify-center gap-2 border-t border-border bg-bg-elevated text-[11px] text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
    >
      <span className="metal flex h-4 w-4 items-center justify-center rounded-sm">
        <Shield className="h-2.5 w-2.5" strokeWidth={2.4} />
      </span>
      <span className="whitespace-nowrap">{t("brand.flag", { name: BRAND_NAME })}</span>
      {dest ? <span className="sr-only">{dest}</span> : null}
    </a>
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
  const [left, setLeft] = useState(DELAY);

  useEffect(() => {
    const started = Date.now();
    const tick = window.setInterval(() => {
      const remain = Math.max(0, DELAY - Math.floor((Date.now() - started) / 1000));
      setLeft(remain);
      if (remain <= 0) {
        window.clearInterval(tick);
        window.location.replace(url);
      }
    }, 200);
    const hard = window.setTimeout(() => window.location.replace(url), DELAY * 1000 + 50);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hard);
    };
  }, [url]);

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
        <p className="mt-8 max-w-2xl truncate text-center text-sm text-white/70">{title}</p>
      ) : null}
      <a
        href={url}
        className="mt-3 max-w-3xl break-all text-center font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl"
      >
        {url}
      </a>
      <p className="mt-4 max-w-2xl text-center text-sm text-white/80">
        {left === 1
          ? t("brand.redirectOne", { url })
          : t("brand.redirect", { n: left, url })}
      </p>
    </div>
  );
}
