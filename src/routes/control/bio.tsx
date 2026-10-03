import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { saveBio, saveBioAvatar } from "@/lib/docbay/api";
import { useControl } from "@/lib/docbay/control-store";
import {
  BIO_BUTTONS,
  BIO_NETWORKS,
  BIO_PALETTE,
  BIO_THEMES,
  type BioLink,
  type BioNetwork,
  type BioPage,
  type BioSocial,
} from "@/lib/docbay/bio";
import { BioStage } from "@/components/public/bio-stage";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useT } from "@/lib/i18n";
import type { FullState } from "@/lib/docbay/types";

export const Route = createFileRoute("/control/bio")({
  component: BioEditorPage,
});

function nid(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`;
}

function BioEditorPage() {
  const t = useT();
  const { data, setData } = useControl();
  const [page, setPage] = useState<BioPage>(data.tenant.bio);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPage(data.tenant.bio);
  }, [data.tenant.id]);

  const host = data.tenant.public_host;
  const url = page.slug ? `https://${host}/${page.slug}` : "";

  async function persist(next: BioPage) {
    setPage(next);
    setBusy(true);
    try {
      const saved = (await saveBio({
        data: { tenant_id: data.tenant.id, page: next as unknown as Record<string, unknown> },
      })) as FullState;
      setData(saved);
      setPage(saved.tenant.bio);
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  function move(list: "links" | "socials", index: number, dir: -1 | 1) {
    const copy = [...page[list]];
    const j = index + dir;
    if (j < 0 || j >= copy.length) return;
    const [row] = copy.splice(index, 1);
    copy.splice(j, 0, row as (typeof copy)[number]);
    setPage({ ...page, [list]: copy });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("bio.title")}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t("bio.hint")}</p>
        </div>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <Toggle
            checked={page.published}
            label={t("bio.published")}
            hint={t("bio.publishedHint")}
            onChange={(published) => void persist({ ...page, published })}
          />
          <div>
            <Label>{t("bio.slug")}</Label>
            <Input
              value={page.slug}
              placeholder="mario"
              onChange={(e) =>
                setPage({ ...page, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
              }
            />
            {url ? <p className="mt-1 font-mono text-[11px] text-fg-subtle">{url}</p> : null}
          </div>
          <p className="text-xs text-fg-muted">
            {t("bio.views")}: {page.views}
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <div>
            <Label>{t("bio.name")}</Label>
            <Input value={page.name} onChange={(e) => setPage({ ...page, name: e.target.value })} />
          </div>
          <div>
            <Label>{t("bio.about")}</Label>
            <Textarea
              value={page.bio}
              rows={3}
              onChange={(e) => setPage({ ...page, bio: e.target.value.slice(0, 280) })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="mb-0">{t("bio.photo")}</Label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
              <Upload className="h-3.5 w-3.5" />
              {t("bio.photoUp")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const dataUrl = await file.arrayBuffer().then((buf) => {
                    const bytes = new Uint8Array(buf);
                    let bin = "";
                    for (const b of bytes) bin += String.fromCharCode(b);
                    return `data:${file.type};base64,${btoa(bin)}`;
                  });
                  setBusy(true);
                  try {
                    const saved = (await saveBioAvatar({
                      data: { tenant_id: data.tenant.id, data: dataUrl, mime: file.type },
                    })) as FullState;
                    setData(saved);
                    setPage((p) => ({ ...p, avatar_url: saved.tenant.bio.avatar_url }));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t("common.error"));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            {page.avatar_url ? (
              <button
                type="button"
                className="text-xs text-fg-muted underline"
                onClick={() => setPage({ ...page, avatar_url: null })}
              >
                {t("bio.photoOff")}
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <Label>{t("bio.theme")}</Label>
          <div className="flex flex-wrap gap-2">
            {BIO_THEMES.map((id) => {
              const pal = BIO_PALETTE[id];
              const on = page.theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPage({ ...page, theme: id })}
                  className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"
                  style={{
                    borderColor: on ? pal.accent : undefined,
                    background: pal.bg,
                    color: pal.fg,
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: pal.accent }} />
                  {t(`bio.theme_${id}`)}
                </button>
              );
            })}
          </div>
          <Label>{t("bio.buttons")}</Label>
          <div className="flex gap-2">
            {BIO_BUTTONS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setPage({ ...page, button: id })}
                className={
                  page.button === id
                    ? "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs"
                    : "rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted"
                }
              >
                {t(`bio.btn_${id}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <div className="flex items-center justify-between">
            <Label className="mb-0">{t("bio.links")}</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                if (page.links.length >= 30) return;
                const row: BioLink = { id: nid("l"), label: "", url: "", highlight: false, clicks: 0 };
                setPage({ ...page, links: [...page.links, row] });
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {t("bio.addLink")}
            </Button>
          </div>
          {page.links.map((l, i) => (
            <div key={l.id} className="space-y-2 rounded-lg border border-border p-2">
              <div className="flex gap-2">
                <Input
                  value={l.label}
                  placeholder={t("bio.linkLabel")}
                  onChange={(e) => {
                    const links = page.links.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    );
                    setPage({ ...page, links });
                  }}
                />
                <Input
                  value={l.url}
                  placeholder="https://"
                  onChange={(e) => {
                    const links = page.links.map((x, idx) =>
                      idx === i ? { ...x, url: e.target.value } : x,
                    );
                    setPage({ ...page, links });
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-fg-muted">
                <button type="button" onClick={() => move("links", i, -1)} aria-label="up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => move("links", i, 1)} aria-label="down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={l.highlight ? "text-primary" : ""}
                  onClick={() => {
                    const links = page.links.map((x, idx) =>
                      idx === i ? { ...x, highlight: !x.highlight } : x,
                    );
                    setPage({ ...page, links });
                  }}
                >
                  {t("bio.highlight")}
                </button>
                <span className="ml-auto tabular">{l.clicks}</span>
                <button
                  type="button"
                  onClick={() => setPage({ ...page, links: page.links.filter((_, idx) => idx !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <div className="flex items-center justify-between">
            <Label className="mb-0">{t("bio.socials")}</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                if (page.socials.length >= 8) return;
                const row: BioSocial = { id: nid("s"), network: "instagram", url: "" };
                setPage({ ...page, socials: [...page.socials, row] });
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {t("bio.addSocial")}
            </Button>
          </div>
          {page.socials.map((s, i) => (
            <div key={s.id} className="flex gap-2">
              <select
                className="h-10 rounded-md border border-border bg-bg px-2 text-sm"
                value={s.network}
                onChange={(e) => {
                  const socials = page.socials.map((x, idx) =>
                    idx === i ? { ...x, network: e.target.value as BioNetwork } : x,
                  );
                  setPage({ ...page, socials });
                }}
              >
                {BIO_NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {t(`bio.net_${n}`)}
                  </option>
                ))}
              </select>
              <Input
                value={s.url}
                placeholder="https://"
                onChange={(e) => {
                  const socials = page.socials.map((x, idx) =>
                    idx === i ? { ...x, url: e.target.value } : x,
                  );
                  setPage({ ...page, socials });
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  setPage({ ...page, socials: page.socials.filter((_, idx) => idx !== i) })
                }
              >
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </Button>
            </div>
          ))}
        </section>

        {data.features.hide_brand_flag && (
          <Toggle
            checked={page.hide_flag}
            label={t("bio.hideFlag")}
            onChange={(hide_flag) => setPage({ ...page, hide_flag })}
          />
        )}

        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void persist(page)}>
            {t("common.save")}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success(t("common.copy"));
              }}
            >
              {t("bio.copy")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-[28px] border border-border shadow-xl" style={{ height: 720 }}>
          <div className="h-full overflow-y-auto">
            <BioStage page={page} preview />
          </div>
        </div>
      </div>
    </div>
  );
}
