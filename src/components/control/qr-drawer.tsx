import { useEffect, useMemo, useState } from "react";
import { Download, ImagePlus, QrCode, X } from "lucide-react";
import {
  downloadQrRaster,
  downloadSvgFile,
  qrToStyledSvg,
  validateQrReadable,
  withQrFlag,
  QR_DOTS,
  type QrDot,
  type QrEye,
  type QrFrame,
  type QrLogoMode,
} from "@/lib/qr";
import { cn } from "@/lib/utils";

const PRESETS = ["#111111", "#1d4ed8", "#0f766e", "#9f1239", "#7c3aed"];

export function QrDrawer({
  url,
  slug,
  variant = "all",
}: {
  url: string;
  slug: string;
  variant?: "all" | "desktop" | "mobile-flag" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const [fg, setFg] = useState("#111111");
  const [bg, setBg] = useState("#ffffff");
  const [dot, setDot] = useState<QrDot>("rounded");
  const [eye, setEye] = useState<QrEye>("rounded");
  const [frame, setFrame] = useState<QrFrame>("none");
  const [logo, setLogo] = useState("");
  const [logoMode, setLogoMode] = useState<QrLogoMode>("off");
  const [readable, setReadable] = useState<boolean | null>(null);

  const svg = useMemo(() => {
    if (!slug) return "";
    try {
      return qrToStyledSvg(withQrFlag(url), {
        fg,
        bg,
        dot,
        eye,
        frame,
        logo,
        logoMode: logo ? logoMode === "off" ? "center" : logoMode : "off",
        modulePx: 10,
      });
    } catch {
      return "";
    }
  }, [url, slug, fg, bg, dot, eye, frame, logo, logoMode]);

  useEffect(() => {
    if (!svg) {
      setReadable(null);
      return;
    }
    let live = true;
    setReadable(null);
    void validateQrReadable({ text: url, svg, fg, bg }).then((ok) => {
      if (live) setReadable(ok);
    });
    return () => {
      live = false;
    };
  }, [svg, url, fg, bg]);

  const name = `qr-${slug || "link"}`;

  const panel = (
    <Panel
      svg={svg}
      bg={bg}
      fg={fg}
      setFg={setFg}
      setBg={setBg}
      dot={dot}
      setDot={setDot}
      eye={eye}
      setEye={setEye}
      frame={frame}
      setFrame={setFrame}
      logo={logo}
      setLogo={setLogo}
      logoMode={logo ? (logoMode === "off" ? "center" : logoMode) : "off"}
      setLogoMode={setLogoMode}
      readable={readable}
      name={name}
    />
  );

  return (
    <>
      {variant === "inline" && (
        <div className="w-full [&>aside]:w-full [&>aside]:max-w-none [&>aside]:border [&>aside]:rounded-xl">
          {panel}
        </div>
      )}
      {(variant === "all" || variant === "desktop") && (
        <div
          className="pointer-events-none absolute top-1/2 right-0 z-10 hidden -translate-y-1/2 @min-[40rem]/stage:block"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <div
            className={cn(
              "flex items-center transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              open ? "translate-x-full" : "translate-x-8",
            )}
          >
            <div className={cn("pointer-events-auto", !open && "pointer-events-none")}>
              {panel}
            </div>
            <Flag vertical open={open} onClick={() => setOpen((v) => !v)} />
          </div>
        </div>
      )}
      {(variant === "all" || variant === "mobile-flag") && (
        <div className="fixed inset-x-0 bottom-0 z-30 @min-[40rem]/stage:hidden">
          <div className="flex flex-col items-center pb-[env(safe-area-inset-bottom)]">
            <div
              className={cn(
                "w-full origin-bottom transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                open ? "translate-y-0" : "pointer-events-none translate-y-[110%]",
              )}
            >
              <div className="mx-auto max-w-lg px-3 pb-2">{panel}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mb-2 flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 text-[11px] font-medium text-fg-muted shadow-sm"
              aria-expanded={open}
            >
              <QrCode className="h-3.5 w-3.5" />
              QR
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Flag({
  vertical,
  open,
  onClick,
}: {
  vertical?: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 border border-border bg-bg-elevated text-[10px] font-medium tracking-wide text-fg-muted shadow-sm hover:text-fg",
        vertical
          ? cn("pointer-events-auto h-36 w-8 flex-col border-l-0 py-4", "rounded-r-md")
          : "h-8 rounded-t-md border-b-0 px-3",
      )}
      aria-expanded={open}
      aria-label="QR-Code"
    >
      <QrCode className="h-3.5 w-3.5" />
      {vertical ? (
        <span className="[writing-mode:vertical-rl] rotate-180">QR</span>
      ) : (
        <span>QR</span>
      )}
    </button>
  );
}

function Panel({
  svg,
  bg,
  fg,
  setFg,
  setBg,
  dot,
  setDot,
  eye,
  setEye,
  frame,
  setFrame,
  logo,
  setLogo,
  logoMode,
  setLogoMode,
  readable,
  name,
}: {
  svg: string;
  bg: string;
  fg: string;
  setFg: (v: string) => void;
  setBg: (v: string) => void;
  dot: QrDot;
  setDot: (v: QrDot) => void;
  eye: QrEye;
  setEye: (v: QrEye) => void;
  frame: QrFrame;
  setFrame: (v: QrFrame) => void;
  logo: string;
  setLogo: (v: string) => void;
  logoMode: QrLogoMode;
  setLogoMode: (v: QrLogoMode) => void;
  readable: boolean | null;
  name: string;
}) {
  return (
    <aside className="flex max-h-[min(80dvh,40rem)] w-[19rem] max-w-full flex-col gap-3 overflow-y-auto border border-r-0 border-border bg-bg-elevated p-3 shadow-xl @min-[40rem]/stage:rounded-none">
      <div>
        <p className="text-xs font-medium">QR zum Mitnehmen</p>
        <p className="text-[11px] text-fg-subtle">
          {readable === true
            ? "Lesbar – Scanner erkennt ihn."
            : readable === false
              ? "Schwer lesbar – Kontrast oder Form ändern."
              : "Prüfe Lesbarkeit…"}
        </p>
      </div>
      <div
        className={cn(
          "flex aspect-square items-center justify-center rounded-md border-2 p-3 transition-colors",
          readable === true
            ? "border-emerald-500"
            : readable === false
              ? "border-orange-400"
              : "border-border",
        )}
        style={{ background: bg }}
      >
        {svg ? (
          <div
            className="flex h-full w-full items-center justify-center [&>svg]:h-full [&>svg]:w-full [&>svg]:max-h-full [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="text-xs text-fg-subtle">Slug fehlt</p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-fg-muted">Farbe</p>
        <div className="flex items-center gap-1.5">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFg(c)}
              className={cn("h-6 w-6 rounded-sm border", fg === c ? "border-fg" : "border-border")}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <label className="ml-auto flex h-6 w-6 overflow-hidden rounded-sm border border-border">
            <input
              type="color"
              value={fg}
              onChange={(e) => setFg(e.target.value)}
              className="h-8 w-8 -translate-x-1 -translate-y-1 cursor-pointer"
            />
          </label>
          <label className="flex h-6 w-6 overflow-hidden rounded-sm border border-border">
            <input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="h-8 w-8 -translate-x-1 -translate-y-1 cursor-pointer"
            />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-fg-muted">Punkte</p>
        <div className="grid grid-cols-3 gap-1">
          {QR_DOTS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDot(d.id)}
              className={cn(
                "h-7 rounded-sm border px-1 text-[10px]",
                dot === d.id ? "border-fg bg-fg text-bg" : "border-border text-fg-muted",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-fg-muted">Auge</p>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["square", "eckig"],
              ["rounded", "weich"],
              ["circle", "rund"],
              ["octagon", "oktogon"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setEye(id)}
              className={cn(
                "h-7 rounded-sm border text-[10px]",
                eye === id ? "border-fg bg-fg text-bg" : "border-border text-fg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-fg-muted">Rahmen</p>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ["none", "ohne"],
              ["corners", "ecken"],
              ["round", "rund"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFrame(id)}
              className={cn(
                "h-7 rounded-sm border text-[10px]",
                frame === id ? "border-fg bg-fg text-bg" : "border-border text-fg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-fg-muted">Logo / Bild</p>
        <div className="flex items-center gap-2">
          <label className="inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm border border-dashed border-border text-[11px] text-fg-muted hover:bg-bg-subtle hover:text-fg">
            <ImagePlus className="h-3.5 w-3.5" />
            {logo ? "Bild tauschen" : "Bild hochladen"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                void fileToLogo(f).then((data) => {
                  setLogo(data);
                  setLogoMode("center");
                });
              }}
            />
          </label>
          {logo && (
            <button
              type="button"
              onClick={() => {
                setLogo("");
                setLogoMode("off");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-fg-muted hover:text-fg"
              aria-label="Logo entfernen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {logo && (
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {(
              [
                ["center", "In der Mitte"],
                ["behind", "Als Hintergrund"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLogoMode(id)}
                className={cn(
                  "h-7 rounded-sm border text-[10px]",
                  logoMode === id ? "border-fg bg-fg text-bg" : "border-border text-fg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 pt-1">
        <SaveBtn label="SVG" onClick={() => svg && downloadSvgFile(svg, `${name}.svg`)} />
        <SaveBtn label="PNG" onClick={() => svg && downloadQrRaster(svg, "png", `${name}.png`)} />
        <SaveBtn label="JPG" onClick={() => svg && downloadQrRaster(svg, "jpeg", `${name}.jpg`)} />
      </div>
    </aside>
  );
}

function SaveBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-border text-[11px] font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg"
    >
      <Download className="h-3 w-3" />
      {label}
    </button>
  );
}

function fileToLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lesen"));
    reader.onload = () => {
      const src = String(reader.result || "");
      const img = new Image();
      img.onload = () => {
        const size = 384;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}