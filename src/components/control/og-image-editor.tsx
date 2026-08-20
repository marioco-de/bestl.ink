import { useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { saveOgImage } from "@/lib/docbay/shorts-api";
import {
  OG_H,
  OG_W,
  blobToBase64,
  composeOg,
  coverCrop,
  fileToUrl,
  loadImage,
  type CropRect,
  type OgFit,
} from "@/lib/og-compose";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function OgImageEditor({
  src,
  tenantId,
  onChange,
  loading,
  autoProcess = true,
}: {
  src: string;
  tenantId: string;
  onChange: (url: string) => void;
  loading?: boolean;
  autoProcess?: boolean;
}) {
  const t = useT();
  const [fit, setFit] = useState<OgFit>("blur");
  const [busy, setBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const processed = useRef("");
  const original = useRef(src);

  useEffect(() => {
    if (src && src !== processed.current) original.current = src;
  }, [src]);

  useEffect(() => {
    if (!autoProcess) return;
    if (!src || src === processed.current || src.startsWith("data:")) return;
    if (fit !== "blur") return;
    let cancel = false;
    void (async () => {
      try {
        setBusy(true);
        const img = await loadImage(src);
        const blob = await composeOg(img, "blur");
        const b64 = await blobToBase64(blob);
        const saved = await saveOgImage({ data: { data: b64, tenant_id: tenantId } });
        if (cancel) return;
        processed.current = saved.url;
        onChange(saved.url);
      } catch {
        /* keep source */
      } finally {
        if (!cancel) setBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [src, tenantId, fit, onChange, autoProcess]);

  async function apply(next: OgFit, crop?: CropRect, from?: string) {
    const url = from || original.current || src;
    if (!url) return;
    setBusy(true);
    try {
      const img = await loadImage(url);
      const blob = await composeOg(img, next, crop);
      const b64 = await blobToBase64(blob);
      const saved = await saveOgImage({ data: { data: b64, tenant_id: tenantId } });
      processed.current = saved.url;
      setFit(next);
      onChange(saved.url);
    } catch (e) {
      console.warn(e);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToUrl(file);
    await apply(fit, undefined, dataUrl);
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md border border-border bg-bg">
        <div className="relative flex aspect-[1.91/1] items-center justify-center bg-bg-subtle">
          {src ? (
            <>
              <img src={src} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl" />
              <img src={src} alt="" className="relative z-10 h-full w-full object-contain" />
            </>
          ) : (
            <Sparkles className="h-6 w-6 text-fg-subtle" />
          )}
          {(loading || busy) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/50">
              <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={cn(
            "h-8 rounded-md border px-2 text-[11px]",
            fit === "blur" ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg",
          )}
          onClick={() => void apply("blur")}
          disabled={!src || busy}
        >
          {t("og.fitBlur")}
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[11px]",
            fit === "crop" ? "border-fg bg-fg text-bg" : "border-border text-fg-muted hover:text-fg",
          )}
          onClick={() => setCropOpen(true)}
          disabled={!src || busy}
        >
          <Crop className="h-3 w-3" /> {t("og.fitCrop")}
        </button>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-[11px] text-fg-muted hover:text-fg">
          <ImagePlus className="h-3 w-3" /> {t("og.replace")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onFile(f);
            }}
          />
        </label>
      </div>
      {cropOpen && (original.current || src) && (
        <CropModal
          src={original.current || src}
          onClose={() => setCropOpen(false)}
          onApply={(rect) => {
            setCropOpen(false);
            void apply("crop", rect);
          }}
        />
      )}
    </div>
  );
}

function CropModal({
  src,
  onClose,
  onApply,
}: {
  src: string;
  onClose: () => void;
  onApply: (rect: CropRect) => void;
}) {
  const t = useT();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: OG_W, h: OG_H });
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const aspect = OG_W / OG_H;

  function rect(): CropRect {
    const w = nat.w;
    const h = nat.h;
    const viewW = w / zoom;
    const viewH = viewW / aspect;
    const sx = Math.max(0, Math.min(w - viewW, (w - viewW) / 2 + off.x));
    const sy = Math.max(0, Math.min(h - viewH, (h - viewH) / 2 + off.y));
    return { sx, sy, sw: Math.min(viewW, w), sh: Math.min(viewH, h) };
  }

  return (
    <FullScreenModal
      title={t("og.cropTitle")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => onApply(rect())}>
            {t("og.apply")}
          </Button>
        </>
      }
    >
      <div
        className="relative mx-auto w-full max-w-lg overflow-hidden rounded-md bg-black"
        style={{ aspectRatio: `${OG_W} / ${OG_H}` }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = (drag.current.x - e.clientX) * (nat.w / 400);
          const dy = (drag.current.y - e.clientY) * (nat.h / 220);
          setOff({ x: drag.current.ox + dx, y: drag.current.oy + dy });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          className="pointer-events-none h-full w-full object-cover"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          onLoad={(e) => {
            const el = e.currentTarget;
            setNat({ w: el.naturalWidth || OG_W, h: el.naturalHeight || OG_H });
            const c = coverCrop(el.naturalWidth, el.naturalHeight);
            setZoom(Math.max(1, el.naturalWidth / c.sw));
          }}
        />
      </div>
      <label className="mt-3 block text-xs text-fg-muted">
        {t("og.zoom")}
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
    </FullScreenModal>
  );
}
