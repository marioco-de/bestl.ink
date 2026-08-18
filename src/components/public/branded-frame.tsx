import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { BRAND_HOME } from "@/lib/docbay/brand";
import { splashCopy } from "@/lib/i18n/splash";

const DELAY = 1;

export function BrandFlag({ dest }: { dest?: string }) {
  const copy = splashCopy();
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
      <span className="whitespace-nowrap">{copy.flag}</span>
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
  const copy = splashCopy();
  const [left, setLeft] = useState(DELAY);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      const remain = Math.max(0, DELAY - Math.floor((Date.now() - started) / 1000));
      setLeft(remain);
      if (remain <= 0) {
        window.clearInterval(tick);
        window.location.replace(url);
      }
    }, 100);
    const hard = window.setTimeout(() => {
      if (!held) window.location.replace(url);
    }, DELAY * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hard);
    };
  }, [url, held]);

  function go() {
    window.location.replace(url);
  }

  const line =
    left <= 1
      ? copy.redirectOne.replace("{url}", url)
      : copy.redirect.replace("{n}", String(left)).replace("{url}", url);

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
        <span>{copy.flag}</span>
      </a>
      {title ? (
        <p className="mt-8 max-w-2xl truncate text-center text-sm text-white/70">{title}</p>
      ) : null}
      <a
        href={url}
        onClick={(e) => {
          e.preventDefault();
          go();
        }}
        className="mt-3 max-w-3xl break-all text-center font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl"
      >
        {url}
      </a>
      {!held && (
        <p className="mt-4 max-w-2xl text-center text-sm text-white/80">{line}</p>
      )}
      <button
        type="button"
        onClick={() => (held ? go() : setHeld(true))}
        className={
          held
            ? "metal mt-6 inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium text-white"
            : "mt-6 inline-flex h-10 items-center rounded-lg border border-white/30 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20"
        }
      >
        {held ? copy.go : copy.cancel}
      </button>
    </div>
  );
}
