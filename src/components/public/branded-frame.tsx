"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Shield } from "lucide-react";
import { BRAND_HOME } from "@/lib/docbay/brand";
import { splashCopy } from "@/lib/i18n/splash";

const DELAY = 3;

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
  const heldRef = useRef(false);

  useEffect(() => {
    if (held) return;
    const id = window.setInterval(() => {
      if (heldRef.current) {
        window.clearInterval(id);
        return;
      }
      setLeft((n) => {
        if (n <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [held, url]);

  useEffect(() => {
    if (held || left > 0) return;
    window.location.replace(url);
  }, [left, held, url]);

  function go() {
    window.location.replace(url);
  }

  function cancel() {
    heldRef.current = true;
    setHeld(true);
  }

  const template = held
    ? copy.held
    : left <= 1
      ? copy.redirectOne
      : copy.redirect.replace("{n}", String(Math.max(left, 1)));

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
        <p className="mt-8 max-w-2xl truncate text-center text-sm opacity-70">{title}</p>
      ) : null}
      <a
        href={url}
        onClick={(e) => {
          e.preventDefault();
          go();
        }}
        className="mt-3 max-w-3xl break-all text-center font-display text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {url}
      </a>
      <p className="mt-5 max-w-2xl text-center text-sm opacity-80">
        <LineWithUrl template={template} url={url} onGo={go} />
      </p>
      <button
        type="button"
        onClick={() => (held ? go() : cancel())}
        className={
          held
            ? "metal mt-6 inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium"
            : "mt-6 inline-flex h-10 items-center rounded-lg border border-current/30 bg-current/10 px-5 text-sm font-medium backdrop-blur-sm hover:bg-current/15"
        }
      >
        {held ? copy.go : copy.cancel}
      </button>
    </div>
  );
}

function LineWithUrl({
  template,
  url,
  onGo,
}: {
  template: string;
  url: string;
  onGo: () => void;
}) {
  const parts = template.split("{url}");
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    nodes.push(part);
    if (i < parts.length - 1) {
      nodes.push(
        <a
          key={i}
          href={url}
          onClick={(e) => {
            e.preventDefault();
            onGo();
          }}
          className="break-all font-medium underline underline-offset-2"
        >
          {url}
        </a>,
      );
    }
  });
  return nodes;
}
