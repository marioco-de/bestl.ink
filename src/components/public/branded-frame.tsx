import { ExternalLink } from "lucide-react";
import { BRAND_NAME } from "@/lib/docbay/brand";

const HOME = "https://www.bestl.ink";

export function BrandedFrame({
  url,
  title,
  showFlag = true,
}: {
  url: string;
  title?: string;
  showFlag?: boolean;
}) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <iframe
        title={title || "link"}
        src={url}
        className="h-full w-full border-0 bg-bg"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
      {showFlag && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-0">
          <div className="pointer-events-auto flex items-stretch shadow-md">
            <a
              href={HOME}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 items-center gap-2 rounded-t-md border border-b-0 border-border bg-bg-elevated px-2.5 text-[11px] leading-none text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
            >
              <span className="metal flex h-4 w-4 items-center justify-center rounded-sm font-display text-[8px] font-semibold text-primary-fg">
                bl
              </span>
              <span className="whitespace-nowrap">
                shortened & secured with{" "}
                <span className="font-medium text-fg">{BRAND_NAME}</span>
              </span>
            </a>
            <a
              href={url}
              target="_top"
              className="flex h-8 w-8 items-center justify-center rounded-tr-md border border-l-0 border-b-0 border-border bg-bg-elevated text-fg-subtle hover:text-fg"
              aria-label="Ziel direkt öffnen"
              title="Direkt öffnen"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
