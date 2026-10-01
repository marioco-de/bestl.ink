import { useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { useControl } from "@/lib/docbay/control-store";
import { saveSplash, saveSplashLogo, clearSplashLogo } from "@/lib/docbay/api";
import { useT } from "@/lib/i18n";
import type { FullState } from "@/lib/docbay/types";
import type { SplashLink, SplashMode } from "@/lib/docbay/splash";
import { DEFAULT_SPLASH } from "@/lib/docbay/splash";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function SplashSettingsCard() {
  const t = useT();
  const { data, setData } = useControl();
  const splash = data.tenant.splash || DEFAULT_SPLASH;
  const feat = data.features;
  const canOff = feat.unbranded_redirect;
  const canCustom = feat.brand_custom;
  const canLogo = feat.splash_logo;
  const canHide = feat.hide_brand_flag;
  const paid = canOff || canCustom || canLogo || canHide;
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function apply(next: FullState) {
    setData(next);
  }

  async function persist(patch: Partial<typeof splash>) {
    const next = { ...splash, ...patch };
    setBusy(true);
    try {
      apply(
        (await saveSplash({
          data: {
            tenant_id: data.tenant.id,
            mode: next.mode,
            hide_flag: next.hide_flag,
            cta_x: next.cta_x,
            cta_y: next.cta_y,
            links: next.links,
          },
        })) as FullState,
      );
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  function onDrag(e: React.PointerEvent) {
    if (!canCustom) return;
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = box.getBoundingClientRect();
      const x = clamp(((ev.clientX - r.left) / r.width) * 100, 8, 92);
      const y = clamp(((ev.clientY - r.top) / r.height) * 100, 10, 92);
      setData({
        ...data,
        tenant: { ...data.tenant, splash: { ...splash, cta_x: x, cta_y: y } },
      });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const r = box.getBoundingClientRect();
      const x = clamp(((ev.clientX - r.left) / r.width) * 100, 8, 92);
      const y = clamp(((ev.clientY - r.top) / r.height) * 100, 10, 92);
      void persist({ cta_x: x, cta_y: y });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (!paid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("workspace.splash")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg-muted">{t("workspace.splashNeedPaid")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workspace.splash")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-fg-muted">{t("workspace.splashHint")}</p>
        <div>
          <Label>{t("workspace.splashMode")}</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
            value={splash.mode}
            disabled={busy}
            onChange={(e) => {
              const mode = e.target.value as SplashMode;
              if (mode === "off" && !canOff) {
                toast.error(t("workspace.splashLocked"));
                return;
              }
              if (mode === "page" && !canCustom) {
                toast.error(t("workspace.splashLocked"));
                return;
              }
              void persist({ mode });
            }}
          >
            <option value="branded">{t("workspace.splashBranded")}</option>
            {canOff && <option value="off">{t("workspace.splashOff")}</option>}
            {canCustom && <option value="page">{t("workspace.splashPage")}</option>}
          </select>
        </div>

        {canCustom && splash.mode !== "off" && (
          <div>
            <Label>{t("workspace.splashCta")}</Label>
            <p className="mb-2 text-[11px] text-fg-subtle">{t("workspace.splashCtaHint")}</p>
            <div
              ref={boxRef}
              className="hop-wash relative h-44 overflow-hidden rounded-lg border border-border"
            >
              <button
                type="button"
                onPointerDown={onDrag}
                style={{ left: `${splash.cta_x}%`, top: `${splash.cta_y}%` }}
                className="metal absolute z-10 inline-flex h-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center rounded-lg px-4 text-xs font-medium active:cursor-grabbing"
              >
                {t("workspace.splashGo")}
              </button>
            </div>
          </div>
        )}

        {canCustom && splash.mode !== "off" && (
          <div className="space-y-2">
            <Label>{t("workspace.splashLinks")}</Label>
            {splash.links.map((l, i) => (
              <div key={l.id} className="flex gap-2">
                <Input
                  value={l.label}
                  placeholder={t("workspace.splashLinkLabel")}
                  onChange={(e) => {
                    const links = splash.links.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    );
                    setData({
                      ...data,
                      tenant: { ...data.tenant, splash: { ...splash, links } },
                    });
                  }}
                  onBlur={() => void persist({ links: splash.links })}
                />
                <Input
                  value={l.url}
                  placeholder="https://"
                  onChange={(e) => {
                    const links = splash.links.map((x, idx) =>
                      idx === i ? { ...x, url: e.target.value } : x,
                    );
                    setData({
                      ...data,
                      tenant: { ...data.tenant, splash: { ...splash, links } },
                    });
                  }}
                  onBlur={() => void persist({ links: splash.links })}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    void persist({ links: splash.links.filter((_, idx) => idx !== i) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            ))}
            {splash.links.length < 12 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const row: SplashLink = {
                    id: `l${Date.now().toString(36)}`,
                    label: "",
                    url: "",
                  };
                  void persist({ links: [...splash.links, row] });
                }}
              >
                <Plus className="h-3.5 w-3.5" /> {t("workspace.splashAddLink")}
              </Button>
            )}
          </div>
        )}

        {canLogo && (
          <div>
            <Label>{t("workspace.splashLogo")}</Label>
            <p className="mb-2 text-[11px] text-fg-subtle">{t("workspace.splashLogoHint")}</p>
            {data.tenant.brand_logo_url && (
              <img
                src={data.tenant.brand_logo_url}
                alt=""
                className="mb-2 max-h-12 object-contain"
              />
            )}
            <div className="flex gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-sm">
                <Upload className="h-3.5 w-3.5" /> {t("workspace.splashLogoUp")}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void (async () => {
                      try {
                        const buf = new Uint8Array(await f.arrayBuffer());
                        let binary = "";
                        const step = 0x8000;
                        for (let i = 0; i < buf.length; i += step) {
                          binary += String.fromCharCode(...buf.subarray(i, i + step));
                        }
                        apply(
                          (await saveSplashLogo({
                            data: {
                              tenant_id: data.tenant.id,
                              data: btoa(binary),
                              mime: f.type || "image/png",
                            },
                          })) as FullState,
                        );
                        toast.success(t("common.saved"));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : t("common.error"));
                      }
                    })();
                  }}
                />
              </label>
              {data.tenant.brand_logo_url && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void clearSplashLogo({ data: { tenant_id: data.tenant.id } }).then((s) =>
                      apply(s as FullState),
                    )
                  }
                >
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </div>
        )}

        {canHide && (
          <Toggle
            label={t("workspace.splashHideFlag")}
            hint={t("workspace.splashHideHint")}
            checked={splash.hide_flag}
            onChange={(v) => void persist({ hide_flag: v })}
          />
        )}
      </CardContent>
    </Card>
  );
}
