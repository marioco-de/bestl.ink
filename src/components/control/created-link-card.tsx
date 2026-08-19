import { useState } from "react";
import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { HueButton } from "@/components/ui/hue-button";
import { hueStyle } from "@/lib/docbay/palette";
import { useT } from "@/lib/i18n";
import { QrDrawer } from "./qr-drawer";

export function CreatedLinkCard({
  url,
  slug,
  hue,
}: {
  url: string;
  slug: string;
  hue: string;
}) {
  const t = useT();
  const [qr, setQr] = useState(false);

  return (
    <div
      className="space-y-4 rounded-xl border border-border p-4"
      style={{
        ...hueStyle(hue),
        background: "linear-gradient(180deg, color-mix(in oklab, var(--hue) 16%, var(--color-bg-elevated)), var(--color-bg-elevated))",
        borderColor: "color-mix(in oklab, var(--hue) 32%, var(--color-border))",
      }}
    >
      <p className="break-all font-display text-lg font-semibold leading-snug tracking-tight">{url}</p>
      <div className="flex items-stretch gap-2">
        <HueButton
          hue={hue}
          className="h-12 min-w-0 flex-1 text-base"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            toast.success(t("common.copy"));
          }}
        >
          <Copy className="h-4 w-4" />
          {t("short.copyLink")}
        </HueButton>
        <button
          type="button"
          aria-label="QR"
          aria-expanded={qr}
          className="hue-action hue-warp flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
          style={hueStyle(hue)}
          onClick={() => setQr((v) => !v)}
        >
          <QrCode className="h-5 w-5" />
        </button>
      </div>
      {qr && <QrDrawer url={url} slug={slug} variant="inline" />}
    </div>
  );
}
