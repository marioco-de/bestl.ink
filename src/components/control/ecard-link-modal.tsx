import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  BIO_ICONS,
  BIO_KINDS,
  BIO_SHAPES,
  BIO_SIZES,
  type BioKind,
  type BioLink,
  type BioShape,
  type BioSize,
} from "@/lib/docbay/bio";
import { BioGlyph } from "@/components/public/bio-icons";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useT } from "@/lib/i18n";

const DEVICES = [
  { id: "ios", label: "iPhone" },
  { id: "android", label: "Android" },
  { id: "desktop", label: "Desktop" },
] as const;

export function EcardLinkModal({
  link,
  onChange,
  onUploadThumb,
  onUploadPdf,
  onAddImages,
  onDelete,
  onClose,
}: {
  link: BioLink;
  onChange: (patch: Partial<BioLink>) => void;
  onUploadThumb: (file: File) => void;
  onUploadPdf: (file: File) => void;
  onAddImages: (files: File[]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [askDelete, setAskDelete] = useState(false);
  const devices = new Set(
    link.rule_devices
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleDevice(id: string) {
    const next = new Set(devices);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ rule_devices: [...next].join(",") });
  }

  const needsUrl = link.kind === "link" || link.kind === "embed";
  const isFolder = link.kind === "folder";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-fg/30 backdrop-blur-sm" aria-label={t("common.close")} onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="ecard-link-title"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-bg-elevated shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="ecard-link-title" className="truncate font-display text-lg font-semibold">
              {link.label || t("bio.linkSettings")}
            </h2>
            <p className="truncate text-xs text-fg-muted">{isFolder ? t("bio.folder") : t(`bio.kind_${link.kind}`)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-fg-muted hover:text-fg"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {!isFolder && (
          <section className="space-y-2">
            <Label>{t("bio.kind")}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BIO_KINDS.map((id) => {
                const on = link.kind === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ kind: id as BioKind })}
                    className={
                      on
                        ? "rounded-xl border border-primary bg-primary/10 px-3 py-2 text-left"
                        : "rounded-xl border border-border px-3 py-2 text-left hover:bg-bg-subtle"
                    }
                  >
                    <span className="block text-sm font-medium">{t(`bio.kind_${id}`)}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-fg-muted">{t(`bio.kindHint_${id}`)}</span>
                  </button>
                );
              })}
            </div>
          </section>
          )}

          <section className="space-y-3">
            <div>
              <Label>{t("bio.linkLabel")}</Label>
              <Input value={link.label} placeholder={t("bio.linkLabel")} onChange={(e) => onChange({ label: e.target.value })} autoFocus />
            </div>
            <div>
              <Label>{t("bio.icon")}</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange({ icon: "" })}
                  className={chip(!link.icon)}
                  aria-label={t("bio.noIcon")}
                >
                  {t("bio.noIcon")}
                </button>
                {BIO_ICONS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ icon: id })}
                    className={`grid h-9 w-9 place-items-center rounded-lg border ${link.icon === id ? "border-primary bg-primary/10" : "border-border text-fg-muted"}`}
                    style={{ color: link.icon_color || undefined }}
                    aria-label={id}
                  >
                    <BioGlyph name={id} className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Label className="mb-0">{t("bio.iconColor")}</Label>
                <input
                  type="color"
                  aria-label={t("bio.iconColor")}
                  value={link.icon_color || "#111111"}
                  onChange={(e) => onChange({ icon_color: e.target.value })}
                  className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                />
                <button type="button" className="text-xs text-fg-muted underline" onClick={() => onChange({ icon_color: "" })}>
                  {t("bio.iconAuto")}
                </button>
              </div>
            </div>
            {needsUrl && (
              <div>
                <Label>{link.kind === "embed" ? t("bio.embedUrl") : t("bio.urlLabel")}</Label>
                <Input value={link.url} placeholder="https://" onChange={(e) => onChange({ url: e.target.value })} />
              </div>
            )}
            {link.kind === "pdf" && (
              <div>
                <Label>{t("bio.addPdf")}</Label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onUploadPdf(file);
                  }}
                />
                <p className="mt-1 text-[11px] text-fg-muted">{t("bio.pdfHint", { n: link.images.length })}</p>
              </div>
            )}
            {link.kind === "gallery" && (
              <div>
                <Label>{t("bio.addGallery")}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {link.images.map((src) => (
                    <button
                      key={src}
                      type="button"
                      className="relative aspect-square overflow-hidden rounded-lg border border-border"
                      onClick={() => onChange({ images: link.images.filter((u) => u !== src) })}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-2 block w-full text-sm"
                  onChange={(e) => {
                    const files = [...(e.target.files || [])];
                    e.target.value = "";
                    if (files.length) onAddImages(files);
                  }}
                />
                <p className="mt-1 text-[11px] text-fg-muted">{t("bio.galleryHint")}</p>
              </div>
            )}
            {link.kind === "capture" && (
              <div className="flex gap-2">
                {(
                  [
                    ["email", "E-Mail"],
                    ["phone", "SMS"],
                    ["both", t("bio.kind_capture")],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ capture: id })}
                    className={
                      link.capture === id
                        ? "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs"
                        : "rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {link.kind === "link" && (
              <div className="flex items-center gap-3">
                {link.thumb_url ? (
                  <img src={link.thumb_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-border text-fg-muted">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                )}
                <label className="cursor-pointer text-sm text-fg-muted">
                  <span className="block font-medium text-fg">{t("bio.thumb")}</span>
                  <span className="text-xs">{t("bio.thumbHint")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) onUploadThumb(file);
                    }}
                  />
                </label>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <Label>{t("bio.look")}</Label>
            <div>
              <p className="mb-1.5 text-xs text-fg-muted">{t("bio.size")}</p>
              <div className="flex gap-2">
                {BIO_SIZES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ size: id as BioSize })}
                    className={chip(link.size === id)}
                  >
                    {t(id === "s" ? "bio.sizeSmall" : id === "m" ? "bio.sizeMedium" : "bio.sizeLarge")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-fg-muted">{t("bio.shape")}</p>
              <div className="flex flex-wrap gap-2">
                {BIO_SHAPES.map((id) => (
                  <button key={id} type="button" onClick={() => onChange({ shape: id as BioShape })} className={chip(link.shape === id)}>
                    {t(`bio.shape_${id}`)}
                  </button>
                ))}
              </div>
            </div>
            <Toggle checked={link.highlight} label={t("bio.highlight")} hint={t("bio.highlightHint")} onChange={(highlight) => onChange({ highlight })} />
            <Toggle checked={link.spotlight} label={t("bio.spotlight")} hint={t("bio.spotlightHint")} onChange={(spotlight) => onChange({ spotlight })} />
          </section>

          <section className="space-y-3">
            <Label>{t("bio.when")}</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("bio.from")}</Label>
                <Input type="datetime-local" value={link.starts_at} onChange={(e) => onChange({ starts_at: e.target.value })} />
              </div>
              <div>
                <Label>{t("bio.until")}</Label>
                <Input type="datetime-local" value={link.ends_at} onChange={(e) => onChange({ ends_at: e.target.value })} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-fg-muted">{t("bio.devicesLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {DEVICES.map((d) => (
                  <button key={d.id} type="button" onClick={() => toggleDevice(d.id)} className={chip(devices.has(d.id))}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("bio.countries")}</Label>
              <Input
                value={link.rule_countries}
                placeholder="DE, AT"
                onChange={(e) => onChange({ rule_countries: e.target.value.toUpperCase() })}
              />
              <p className="mt-1 text-[11px] text-fg-subtle">{t("bio.countriesHint")}</p>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-fg-muted">{t("bio.hoursLabel")}</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  className="w-20"
                  placeholder="9"
                  value={link.rule_from ?? ""}
                  onChange={(e) => onChange({ rule_from: e.target.value === "" ? null : Number(e.target.value) })}
                />
                <span className="text-fg-muted">–</span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  className="w-20"
                  placeholder="18"
                  value={link.rule_to ?? ""}
                  onChange={(e) => onChange({ rule_to: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
            </div>
            <Toggle checked={link.sensitive} label={t("bio.sensitive")} hint={t("bio.sensitiveHint")} onChange={(sensitive) => onChange({ sensitive })} />
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          {askDelete ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAskDelete(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" size="sm" onClick={onDelete}>
                {t("common.delete")}
              </Button>
            </div>
          ) : (
            <button type="button" className="text-sm text-danger" onClick={() => setAskDelete(true)}>
              {t("bio.deleteLink")}
            </button>
          )}
          <Button type="button" onClick={onClose}>
            {t("bio.done")}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function chip(on: boolean) {
  return on
    ? "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs"
    : "rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted";
}
