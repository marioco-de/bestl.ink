import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Settings, Trash2, Upload } from "lucide-react";
import { BioGlyph } from "@/components/public/bio-icons";
import { toast } from "sonner";
import { bioReport, saveBio, saveBioAvatar } from "@/lib/docbay/api";
import { useControl } from "@/lib/docbay/control-store";
import {
  BIO_BUTTONS,
  BIO_FONTS,
  BIO_HEADERS,
  BIO_LAYOUTS,
  BIO_NETWORKS,
  BIO_PALETTE,
  BIO_SHAPES,
  paletteFor,
  BIO_THEMES,
  blankLink,
  colorPairings,
  type BioLink,
  type BioNetwork,
  type BioPage,
} from "@/lib/docbay/bio";
import { BioStage } from "@/components/public/bio-stage";
import { EcardLinkModal } from "@/components/control/ecard-link-modal";
import { qrToSvg } from "@/lib/qr";
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
  const seed = data.tenant.bio_cards?.length ? data.tenant.bio_cards : [data.tenant.bio];
  const [cards, setCards] = useState<BioPage[]>(seed);
  const [activeId, setActiveId] = useState(data.tenant.bio?.id || seed[0]?.id || "main");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<typeof bioReport>> | null>(null);
  const page = cards.find((c) => c.id === activeId) || cards[0]!;
  const editing = page.links.find((l) => l.id === editId) ?? null;
  const scope = page.links.find((l) => l.id === scopeId && l.kind === "folder") ?? null;
  const rows = page.links
    .map((l, index) => ({ l, index }))
    .filter(({ l }) => (l.parent_id || "") === (scope?.id || ""));

  useEffect(() => {
    const next = data.tenant.bio_cards?.length ? data.tenant.bio_cards : [data.tenant.bio];
    setCards(next);
    setActiveId(data.tenant.bio?.id || next[0]?.id || "main");
  }, [data.tenant.id]);

  const host = data.tenant.public_host;
  const url = page.slug ? `https://${host}/${page.slug}` : "";

  function update(next: BioPage) {
    setCards((list) => list.map((c) => (c.id === next.id ? next : c)));
  }

  function tune(patch: Partial<BioPage>) {
    const base = paletteFor(page);
    update({
      ...page,
      ...patch,
      theme: "custom",
      bg_color: patch.bg_color ?? (page.bg_color || base.bg),
      fg_color: patch.fg_color ?? (page.fg_color || base.fg),
    });
  }

  function pickTheme(id: Exclude<BioPage["theme"], "custom">) {
    update({ ...page, theme: id, bg_color: "", fg_color: "", glow_color: "" });
  }

  function addItem(kind: "link" | "heading" | "folder") {
    if (page.links.length >= 40) return;
    const row = blankLink({
      id: nid(kind === "heading" ? "g" : kind === "folder" ? "f" : "l"),
      kind,
      label: kind === "heading" ? t("bio.addCollection") : kind === "folder" ? t("bio.folder") : "",
      parent_id: kind === "folder" ? "" : scopeId || "",
    });
    update({ ...page, links: [...page.links, row] });
    if (kind === "link" || kind === "folder") setEditId(row.id);
  }

  function patchLink(index: number, patch: Partial<BioLink>) {
    update({
      ...page,
      links: page.links.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    });
  }

  async function persist(list = cards, active = page.id) {
    setBusy(true);
    try {
      const saved = (await saveBio({
        data: {
          tenant_id: data.tenant.id,
          page: (list.find((c) => c.id === active) || list[0]) as unknown as Record<string, unknown>,
          cards: list as unknown as Record<string, unknown>[],
          active,
        },
      })) as FullState;
      setData(saved);
      const next = saved.tenant.bio_cards?.length ? saved.tenant.bio_cards : [saved.tenant.bio];
      setCards(next);
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File, field: "avatar" | "logo" | "bg" | "thumb", linkId?: string) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const dataUrl = `data:${file.type};base64,${btoa(bin)}`;
    setBusy(true);
    try {
      const saved = (await saveBioAvatar({
        data: {
          tenant_id: data.tenant.id,
          data: dataUrl,
          mime: file.type,
          field,
          card_id: page.id,
          link_id: linkId,
        },
      })) as FullState;
      setData(saved);
      const next = saved.tenant.bio_cards?.length ? saved.tenant.bio_cards : [saved.tenant.bio];
      const look = paletteFor(page);
      setCards(
        field === "bg"
          ? next.map((c) =>
              c.id === page.id
                ? { ...c, theme: "custom", bg_color: c.bg_color || look.bg, fg_color: c.fg_color || look.fg }
                : c,
            )
          : next,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const pairs = colorPairings(page.bg_color || BIO_PALETTE[page.theme].bg);
  const qr = url ? qrToSvg(url, 6) : "";

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{t("bio.title")}</h1>
            <p className="mt-1 text-sm text-fg-muted">{t("bio.hint")}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
              value={page.id}
              onChange={(e) => setActiveId(e.target.value)}
            >
              {cards.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.name || `${t("bio.cards")} ${i + 1}`}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                if (cards.length >= 8) return;
                const row: BioPage = {
                  ...page,
                  id: nid("c"),
                  slug: "",
                  name: "",
                  published: false,
                  links: [],
                  socials: [],
                  collections: [],
                  views: 0,
                };
                setCards((list) => [...list, row]);
                setActiveId(row.id);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {t("bio.addCard")}
            </Button>
          </div>
        </div>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <Toggle
            checked={page.published}
            label={t("bio.published")}
            hint={t("bio.publishedHint")}
            onChange={(published) => update({ ...page, published })}
          />
          <div>
            <Label>{t("bio.slug")}</Label>
            <Input
              value={page.slug}
              placeholder="mario"
              onChange={(e) =>
                update({ ...page, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
              }
            />
            {url ? <p className="mt-1 font-mono text-[11px] text-fg-subtle">{url}</p> : null}
          </div>
          <p className="text-xs text-fg-muted">
            {t("bio.views")}: {page.views}
          </p>
          {qr ? (
            <img
              alt="QR"
              className="h-28 w-28 rounded-md border border-border bg-white"
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`}
            />
          ) : null}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <div>
            <Label>{t("bio.name")}</Label>
            <Input value={page.name} onChange={(e) => update({ ...page, name: e.target.value })} />
          </div>
          <div>
            <Label>{t("bio.about")}</Label>
            <Textarea value={page.bio} rows={3} onChange={(e) => update({ ...page, bio: e.target.value.slice(0, 280) })} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
            <FileBtn label={t("bio.photoUp")} onFile={(f) => void upload(f, "avatar")} />
            <FileBtn label={t("bio.headerLogo")} onFile={(f) => void upload(f, "logo")} />
            <FileBtn label={t("bio.bgImage")} onFile={(f) => void upload(f, "bg")} />
          </div>
          <div>
            <Label>{t("bio.header")}</Label>
            <Choice
              value={page.header}
              options={BIO_HEADERS.map((id) => ({ id, label: t(`bio.header${id[0]!.toUpperCase()}${id.slice(1)}`) }))}
              onChange={(header) => tune({ header })}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <Label>{t("bio.theme")}</Label>
          <div className="flex flex-wrap gap-2">
            {BIO_THEMES.filter((id) => id !== "custom").map((id) => {
              const pal = BIO_PALETTE[id];
              const on = page.theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => pickTheme(id)}
                  className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"
                  style={{ borderColor: on ? pal.accent : undefined, background: pal.bg, color: pal.fg }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: pal.accent }} />
                  {t(`bio.theme_${id}`)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => tune({})}
              className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"
              style={{
                borderColor: page.theme === "custom" ? paletteFor(page).fg : undefined,
                background: paletteFor(page).bg,
                color: paletteFor(page).fg,
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: `conic-gradient(${paletteFor(page).fg}, ${paletteFor(page).bg}, ${paletteFor(page).fg})`,
                }}
              />
              {t("bio.theme_custom")}
            </button>
          </div>
          <Label>{t("bio.buttons")}</Label>
          <Choice
            value={page.button}
            options={BIO_BUTTONS.map((id) => ({ id, label: t(`bio.btn_${id}`) }))}
            onChange={(button) => tune({ button })}
          />
          <Label>{t("bio.layout")}</Label>
          <Choice
            value={page.layout}
            options={BIO_LAYOUTS.map((id) => ({ id, label: t(`bio.layout_${id}`) }))}
            onChange={(layout) => tune({ layout })}
          />
          <Label>{t("bio.font")}</Label>
          <Choice
            value={page.font}
            options={BIO_FONTS.map((id) => ({ id, label: t(`bio.font_${id}`) }))}
            onChange={(font) => tune({ font })}
          />
          <Label>{t("bio.shape")}</Label>
          <Choice
            value={page.button_shape}
            options={BIO_SHAPES.map((id) => ({ id, label: t(`bio.shape_${id}`) }))}
            onChange={(button_shape) => tune({ button_shape })}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-fg-muted">
              {t("bio.colorBg")}
              <input type="color" className="mt-1 h-9 w-full" value={page.bg_color || paletteFor(page).bg} onChange={(e) => tune({ bg_color: e.target.value })} />
            </label>
            <label className="text-xs text-fg-muted">
              {t("bio.colorFg")}
              <input type="color" className="mt-1 h-9 w-full" value={page.fg_color || paletteFor(page).fg} onChange={(e) => tune({ fg_color: e.target.value })} />
            </label>
            <label className="text-xs text-fg-muted">
              {t("bio.glow")}
              <input type="color" className="mt-1 h-9 w-full" value={page.glow_color || paletteFor(page).accent} onChange={(e) => tune({ glow_color: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {pairs.map((p) => (
              <button
                key={p.label}
                type="button"
                className="rounded-full px-3 py-1 text-xs"
                style={{ background: p.bg, color: p.fg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }}
                onClick={() => tune({ bg_color: p.bg, fg_color: p.fg })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <Label>{t("bio.bgVideo")}</Label>
            <Input value={page.bg_video_url || ""} onChange={(e) => tune({ bg_video_url: e.target.value || null })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("bio.seoTitle")}</Label>
              <Input value={page.seo_title} onChange={(e) => update({ ...page, seo_title: e.target.value })} />
            </div>
            <div>
              <Label>{t("bio.seoDesc")}</Label>
              <Input value={page.seo_description} onChange={(e) => update({ ...page, seo_description: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-bg-elevated p-4">
          {scope ? (
            <button type="button" className="flex items-center gap-1 text-sm text-fg-muted" onClick={() => setScopeId(null)}>
              <ChevronLeft className="h-4 w-4" />
              {scope.label || t("bio.folder")}
            </button>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="mb-0">{scope ? t("bio.folder") : t("bio.elements")}</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => addItem("link")}>
                <Plus className="h-3.5 w-3.5" /> {t("bio.addLink")}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => addItem("heading")}>
                <Plus className="h-3.5 w-3.5" /> {t("bio.addCollection")}
              </Button>
              {!scope ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => addItem("folder")}>
                  <Plus className="h-3.5 w-3.5" /> {t("bio.addFolder")}
                </Button>
              ) : null}
            </div>
          </div>
          {rows.map(({ l, index }) =>
            l.kind === "heading" ? (
              <div key={l.id} className="flex items-center gap-2 rounded-xl bg-bg-subtle px-2 py-1.5">
                <Nudge onUp={() => moveAmong(page, l.id, -1, update)} onDown={() => moveAmong(page, l.id, 1, update)} />
                <Input
                  value={l.label}
                  placeholder={t("bio.addCollection")}
                  className="h-9 border-transparent bg-transparent font-medium shadow-none"
                  onChange={(e) => patchLink(index, { label: e.target.value })}
                />
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-fg-muted hover:text-danger"
                  onClick={() => update({ ...page, links: page.links.filter((x) => x.id !== l.id) })}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div key={l.id} className={`flex items-center gap-2 rounded-xl border border-border bg-bg px-2 ${l.kind === "folder" ? "min-h-[68px] py-2" : "py-1.5"}`}>
                <Nudge onUp={() => moveAmong(page, l.id, -1, update)} onDown={() => moveAmong(page, l.id, 1, update)} />
                {l.thumb_url ? (
                  <img src={l.thumb_url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                ) : l.icon || l.kind === "folder" ? (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-bg-subtle text-fg-muted">
                    <BioGlyph name={l.icon || "folder"} className="h-4 w-4" />
                  </span>
                ) : null}
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => (l.kind === "folder" ? setScopeId(l.id) : setEditId(l.id))}
                >
                  <p className="truncate text-sm font-medium">{l.label || t("bio.addLink")}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {l.kind === "folder"
                      ? `${page.links.filter((x) => x.parent_id === l.id && x.kind !== "heading").length}`
                      : l.url || t(`bio.kind_${l.kind}`)}
                  </p>
                </button>
                {l.clicks > 0 ? <span className="text-xs tabular-nums text-fg-muted">{l.clicks}</span> : null}
                {l.kind === "folder" ? (
                  <button type="button" className="grid h-9 w-9 place-items-center text-fg-muted" onClick={() => setScopeId(l.id)} aria-label={t("bio.folder")}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditId(l.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-fg-muted hover:bg-bg-subtle hover:text-fg"
                  aria-label={t("bio.linkSettings")}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            ),
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <div className="flex items-center justify-between">
            <Label className="mb-0">{t("bio.socials")}</Label>
            <Button type="button" size="sm" variant="secondary" onClick={() => {
              if (page.socials.length >= 8) return;
              update({ ...page, socials: [...page.socials, { id: nid("s"), network: "instagram", url: "" }] });
            }}>
              <Plus className="h-3.5 w-3.5" /> {t("bio.addSocial")}
            </Button>
          </div>
          {page.socials.map((s, i) => (
            <div key={s.id} className="flex gap-2">
              <select className="h-10 rounded-md border border-border bg-bg px-2 text-sm" value={s.network} onChange={(e) => update({ ...page, socials: page.socials.map((x, idx) => idx === i ? { ...x, network: e.target.value as BioNetwork } : x) })}>
                {BIO_NETWORKS.map((n) => <option key={n} value={n}>{t(`bio.net_${n}`)}</option>)}
              </select>
              <Input value={s.url} placeholder="https://" onChange={(e) => update({ ...page, socials: page.socials.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x) })} />
              <Button type="button" size="icon" variant="ghost" onClick={() => update({ ...page, socials: page.socials.filter((_, idx) => idx !== i) })}>
                <Trash2 className="h-3.5 w-3.5 text-danger" />
              </Button>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-bg-elevated p-4">
          <div>
            <Label>{t("bio.redirect")}</Label>
            <Input value={page.redirect_url} placeholder="https://" onChange={(e) => update({ ...page, redirect_url: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("bio.ga")}</Label>
              <Input value={page.ga_id} placeholder="G-XXXX" onChange={(e) => update({ ...page, ga_id: e.target.value.trim() })} />
            </div>
            <div>
              <Label>{t("bio.pixel")}</Label>
              <Input value={page.pixel_id} onChange={(e) => update({ ...page, pixel_id: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
          <div>
            <Label>{t("bio.sheets")}</Label>
            <Input value={page.sheets_url} placeholder="https://" onChange={(e) => update({ ...page, sheets_url: e.target.value })} />
          </div>
          {data.features.hide_brand_flag && (
            <Toggle checked={page.hide_flag} label={t("bio.hideFlag")} onChange={(hide_flag) => update({ ...page, hide_flag })} />
          )}
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-bg-elevated p-4">
          <p className="text-sm font-medium">{t("bio.team")}</p>
          <p className="text-xs text-fg-muted">{t("bio.teamHint")}</p>
          <ul className="text-sm text-fg-muted">
            {data.members.slice(0, 12).map((m) => (
              <li key={m.id}>{m.name || m.email || m.role} · {m.role}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-bg-elevated p-4">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => {
              void bioReport({ data: { tenant_id: data.tenant.id, slug: page.slug } }).then(setReport).catch((e) => toast.error(e instanceof Error ? e.message : t("common.error")));
            }}>{t("bio.report")}</Button>
            {report ? (
              <Button type="button" variant="secondary" onClick={() => downloadCsv(page.slug || "ecard", report)}>{t("bio.csv")}</Button>
            ) : null}
          </div>
          {report ? (
            <div className="grid gap-2 text-xs text-fg-muted sm:grid-cols-3">
              <p>{t("bio.views")}: {report.views}</p>
              <p>Klicks: {report.clicks}</p>
              <p>{report.countries.map((c) => `${c.k} ${c.n}`).join(" · ")}</p>
              <p>{report.devices.map((c) => `${c.k} ${c.n}`).join(" · ")}</p>
              <p className="sm:col-span-2">{report.sources.map((c) => `${c.k} ${c.n}`).join(" · ")}</p>
              <p className="sm:col-span-3">{report.leads.length} Leads</p>
            </div>
          ) : null}
        </section>

        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void persist()}>{t("common.save")}</Button>
          {url ? (
            <Button type="button" variant="secondary" onClick={() => { void navigator.clipboard.writeText(url); toast.success(t("common.copy")); }}>
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
      {editing && (
        <EcardLinkModal
          link={editing}
          onChange={(patch) => {
            const i = page.links.findIndex((l) => l.id === editing.id);
            if (i >= 0) patchLink(i, patch);
          }}
          onUploadThumb={(file) => void upload(file, "thumb", editing.id)}
          onDelete={() => {
            update({
              ...page,
              links: page.links.filter((l) => l.id !== editing.id && l.parent_id !== editing.id),
            });
            if (scopeId === editing.id) setScopeId(null);
            setEditId(null);
          }}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}

function moveAmong(page: BioPage, id: string, dir: -1 | 1, update: (p: BioPage) => void) {
  const item = page.links.find((l) => l.id === id);
  if (!item) return;
  const parent = item.parent_id || "";
  const siblings = page.links.filter((l) => (l.parent_id || "") === parent);
  const i = siblings.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= siblings.length) return;
  const next = [...siblings];
  const [row] = next.splice(i, 1);
  next.splice(j, 0, row!);
  let n = 0;
  update({
    ...page,
    links: page.links.map((l) => ((l.parent_id || "") === parent ? next[n++]! : l)),
  });
}

function Nudge({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="flex flex-col text-fg-muted">
      <button type="button" className="rounded p-0.5 hover:bg-bg-subtle" onClick={onUp} aria-label="up">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded p-0.5 hover:bg-bg-subtle" onClick={onDown} aria-label="down">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={value === o.id ? "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs" : "rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted"}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FileBtn({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-fg-muted">
      <Upload className="h-3.5 w-3.5" />
      {label}
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onFile(file);
      }} />
    </label>
  );
}

function downloadCsv(slug: string, report: Awaited<ReturnType<typeof bioReport>>) {
  const lines = ["type,key,value"];
  lines.push(`views,,${report.views}`);
  lines.push(`clicks,,${report.clicks}`);
  for (const row of report.countries) lines.push(`country,${csv(row.k)},${row.n}`);
  for (const row of report.devices) lines.push(`device,${csv(row.k)},${row.n}`);
  for (const row of report.sources) lines.push(`source,${csv(row.k)},${row.n}`);
  lines.push("kind,name,email,phone,message,when");
  for (const l of report.leads) {
    lines.push([l.kind, l.name, l.email, l.phone, l.message, l.when_text].map(csv).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug || "ecard"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csv(v: string) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
