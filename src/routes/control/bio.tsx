import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, GripVertical, Plus, Settings, Trash2, Upload } from "lucide-react";
import { BioGlyph } from "@/components/public/bio-icons";
import { toast } from "sonner";
import { bioReport, saveBio, saveBioAvatar } from "@/lib/docbay/api";
import { useControl } from "@/lib/docbay/control-store";
import {
  BIO_BUTTONS,
  BIO_FONTS,
  BIO_HEADERS,
  BIO_ICONS,
  BIO_LAYOUTS,
  LINE_WIDTHS,
  BIO_NETWORKS,
  networkFromUrl,
  BIO_PALETTE,
  BIO_SHAPES,
  paletteFor,
  lineWidth,
  BIO_THEMES,
  blankLink,
  suggestColors,
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
  const [picked, setPicked] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [over, setOver] = useState<{ id: string; mode: "before" | "after" | "into" } | null>(null);
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [colorFrom, setColorFrom] = useState<"bg" | "fg" | "glow" | null>(null);
  const dragRef = useRef<string[]>([]);
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

  useEffect(() => {
    setPicked([]);
    setAnchorId(null);
  }, [scopeId, activeId]);

  useEffect(() => {
    if (!iconFor) return;
    function close(e: PointerEvent) {
      const node = e.target as HTMLElement | null;
      if (node?.closest("[data-icon-pop], [data-icon-anchor]")) return;
      setIconFor(null);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [iconFor]);

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

  function pickRow(e: React.MouseEvent, id: string) {
    const ids = rows.map((r) => r.l.id);
    if (e.shiftKey && anchorId && ids.includes(anchorId) && ids.includes(id)) {
      const a = ids.indexOf(anchorId);
      const b = ids.indexOf(id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setPicked(ids.slice(lo, hi + 1));
      return true;
    }
    if (e.metaKey || e.ctrlKey) {
      setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      setAnchorId(id);
      return true;
    }
    if (selecting) {
      setPicked([id]);
      setAnchorId(id);
      return true;
    }
    setAnchorId(id);
    return false;
  }

  function dragIdsFor(id: string) {
    const visible = new Set(rows.map((r) => r.l.id));
    if (picked.includes(id)) return picked.filter((x) => visible.has(x));
    return [id];
  }

  function dropMode(e: React.DragEvent, id: string): "before" | "after" | "into" {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const link = page.links.find((l) => l.id === id);
    const moving = dragRef.current;
    const onlyFolders = moving.every((did) => page.links.find((l) => l.id === did)?.kind === "folder");
    if (link?.kind === "folder" && !onlyFolders && !moving.includes(id) && y > rect.height * 0.22 && y < rect.height * 0.78) return "into";
    return y < rect.height / 2 ? "before" : "after";
  }

  function applyDrop(movingIds: string[], targetId: string, mode: "before" | "after" | "into") {
    const movingSet = new Set(movingIds);
    if (mode === "into") {
      const folder = page.links.find((l) => l.id === targetId && l.kind === "folder");
      if (!folder) return;
      const allowed = page.links.filter((l) => movingSet.has(l.id) && l.kind !== "folder");
      if (!allowed.length) return;
      const allowedIds = new Set(allowed.map((l) => l.id));
      const updated = page.links.map((l) => (allowedIds.has(l.id) ? { ...l, parent_id: folder.id } : l));
      const siblings = updated.filter((l) => (l.parent_id || "") === folder.id);
      const stay = siblings.filter((l) => !allowedIds.has(l.id));
      const moved = siblings.filter((l) => allowedIds.has(l.id));
      const ordered = [...stay, ...moved];
      let n = 0;
      update({ ...page, links: updated.map((l) => ((l.parent_id || "") === folder.id ? ordered[n++]! : l)) });
      setPicked((prev) => prev.filter((id) => !allowedIds.has(id)));
      return;
    }
    const parent = targetId === "__out" ? "" : scope?.id || "";
    const moved = page.links.filter((l) => movingSet.has(l.id)).map((l) => ({ ...l, parent_id: parent }));
    if (!moved.length || (targetId !== "__out" && movingSet.has(targetId))) return;
    const rest = page.links.filter((l) => !movingSet.has(l.id));
    if (targetId === "__out") {
      update({ ...page, links: [...rest, ...moved] });
      setPicked([]);
      return;
    }
    const at = rest.findIndex((l) => l.id === targetId);
    const insert = at < 0 ? rest.length : mode === "after" ? at + 1 : at;
    update({ ...page, links: [...rest.slice(0, insert), ...moved, ...rest.slice(insert)] });
  }

  function bindDrag(id: string) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const el = e.target as HTMLElement;
        if (el.closest("input, textarea, button")) {
          e.preventDefault();
          return;
        }
        const ids = dragIdsFor(id);
        dragRef.current = ids;
        e.dataTransfer.setData("text/plain", ids.join(","));
        e.dataTransfer.effectAllowed = "move";
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        const mode = dropMode(e, id);
        setOver((prev) => (prev?.id === id && prev.mode === mode ? prev : { id, mode }));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        applyDrop(dragRef.current, id, dropMode(e, id));
        dragRef.current = [];
        setOver(null);
      },
      onDragEnd: () => {
        dragRef.current = [];
        setOver(null);
      },
    };
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
          {page.button === "line" ? (
            <label className="block text-xs text-fg-muted">
              <span className="mb-1 flex items-center justify-between">
                {t("bio.lineWidth")}
                <span className="tabular-nums">{lineWidth(page.line_width)} px</span>
              </span>
              <input
                type="range"
                min={0}
                max={LINE_WIDTHS.length - 1}
                step={1}
                value={Math.max(0, LINE_WIDTHS.indexOf(lineWidth(page.line_width) as (typeof LINE_WIDTHS)[number]))}
                className="w-full accent-[var(--color-primary)]"
                onChange={(e) => tune({ line_width: LINE_WIDTHS[Number(e.target.value)] ?? 1 })}
              />
            </label>
          ) : null}
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
            {(
              [
                ["bg", t("bio.colorBg"), page.bg_color || paletteFor(page).bg],
                ["fg", t("bio.colorFg"), page.fg_color || paletteFor(page).fg],
                ["glow", t("bio.glow"), page.glow_color || paletteFor(page).accent],
              ] as const
            ).map(([key, label, value]) => {
              const source =
                colorFrom === "bg"
                  ? page.bg_color || paletteFor(page).bg
                  : colorFrom === "fg"
                    ? page.fg_color || paletteFor(page).fg
                    : colorFrom === "glow"
                      ? page.glow_color || paletteFor(page).accent
                      : "";
              const ideas = colorFrom && colorFrom !== key ? suggestColors(source) : [];
              return (
                <div key={key} className="text-xs text-fg-muted">
                  {label}
                  <input
                    type="color"
                    className="mt-1 h-9 w-full"
                    value={value}
                    onChange={(e) => {
                      const hex = e.target.value;
                      setColorFrom(key);
                      tune(key === "bg" ? { bg_color: hex } : key === "fg" ? { fg_color: hex } : { glow_color: hex });
                    }}
                  />
                  {ideas.length > 0 ? (
                    <span className="mt-1.5 flex gap-1">
                      {ideas.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={c}
                          className="h-6 flex-1 rounded-md"
                          style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)" }}
                          onClick={() => tune(key === "bg" ? { bg_color: c } : key === "fg" ? { fg_color: c } : { glow_color: c })}
                        />
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            })}
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
          <p className="text-xs text-fg-muted">{t("bio.legalHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("bio.customerImprint")}</Label>
              <Input value={page.impressum_url} placeholder="https://" onChange={(e) => update({ ...page, impressum_url: e.target.value })} />
            </div>
            <div>
              <Label>{t("bio.customerPrivacy")}</Label>
              <Input value={page.privacy_url} placeholder="https://" onChange={(e) => update({ ...page, privacy_url: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-bg-elevated p-4">
          {scope ? (
            <button
              type="button"
              className={`flex w-full items-center gap-1 rounded-lg px-1 py-1 text-sm text-fg-muted ${over?.id === "__out" ? "bg-primary/10 ring-1 ring-primary" : ""}`}
              onClick={() => setScopeId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver({ id: "__out", mode: "before" });
              }}
              onDrop={(e) => {
                e.preventDefault();
                applyDrop(dragRef.current, "__out", "before");
                dragRef.current = [];
                setOver(null);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              {over?.id === "__out" ? t("bio.dropOut") : scope.label || t("bio.folder")}
            </button>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="mb-0">{scope ? t("bio.folder") : t("bio.elements")}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={selecting ? "default" : "secondary"}
                onClick={() => {
                  setSelecting((v) => !v);
                  setPicked([]);
                  setAnchorId(null);
                }}
              >
                {t("bio.select")}
              </Button>
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
          {picked.length > 0 ? (
            <p className="text-xs text-fg-muted">
              {picked.length} {t("bio.selected")}
            </p>
          ) : selecting ? (
            <p className="text-xs text-fg-muted">{t("bio.selectHint")}</p>
          ) : null}
          {rows.map(({ l, index }) => {
            const mark = over?.id === l.id ? over.mode : null;
            const on = picked.includes(l.id);
            const edge = mark === "before" ? "border-t-2 border-t-primary" : mark === "after" ? "border-b-2 border-b-primary" : "";
            const into = mark === "into" ? "ring-2 ring-primary bg-primary/10" : "";
            return l.kind === "heading" ? (
              <div
                key={l.id}
                {...bindDrag(l.id)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("input, textarea, button")) return;
                  pickRow(e, l.id);
                }}
                className={`flex cursor-grab items-center gap-2 rounded-xl bg-bg-subtle px-2 py-1.5 active:cursor-grabbing ${on ? "ring-1 ring-primary" : ""} ${edge}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-fg-muted" />
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
              <div
                key={l.id}
                {...bindDrag(l.id)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  if (pickRow(e, l.id)) return;
                  if (l.kind === "folder") setScopeId(l.id);
                  else setEditId(l.id);
                }}
                className={`relative flex cursor-grab items-center gap-2 rounded-xl border border-border bg-bg px-2 active:cursor-grabbing ${l.kind === "folder" ? "min-h-[68px] py-2" : "py-1.5"} ${on ? "bg-primary/10 ring-1 ring-primary" : ""} ${into} ${edge} ${iconFor === l.id ? "z-20" : ""}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-fg-muted" />
                <Nudge onUp={() => moveAmong(page, l.id, -1, update)} onDown={() => moveAmong(page, l.id, 1, update)} />
                {l.thumb_url ? (
                  <img src={l.thumb_url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                ) : null}
                <button
                  type="button"
                  className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-bg-subtle text-fg-muted"
                  style={{ color: l.icon_color || undefined }}
                  data-icon-anchor
                  aria-label={t("bio.icon")}
                  onClick={() => setIconFor((id) => (id === l.id ? null : l.id))}
                >
                  {l.icon || l.kind === "folder" ? <BioGlyph name={l.icon || "folder"} className="h-4 w-4" /> : <span className="h-3 w-3 rounded-sm border border-dashed border-current" />}
                  {iconFor === l.id ? (
                    <span
                      data-icon-pop
                      className="absolute left-0 top-11 z-30 w-[248px] rounded-xl border border-border bg-bg p-2 text-fg shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="grid grid-cols-8 gap-1">
                        <button
                          type="button"
                          className={`grid h-7 w-7 place-items-center rounded-md border text-[10px] ${!l.icon ? "border-primary" : "border-transparent"}`}
                          onClick={() => patchLink(index, { icon: "" })}
                          aria-label={t("bio.noIcon")}
                        />
                        {BIO_ICONS.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className={`grid h-7 w-7 place-items-center rounded-md border ${l.icon === id ? "border-primary bg-primary/10" : "border-transparent hover:bg-bg-subtle"}`}
                            style={{ color: l.icon_color || undefined }}
                            onClick={() => patchLink(index, { icon: id })}
                            aria-label={id}
                          >
                            <BioGlyph name={id} className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </span>
                      <span className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                        <input
                          type="color"
                          aria-label={t("bio.iconColor")}
                          value={l.icon_color || "#111111"}
                          onChange={(e) => patchLink(index, { icon_color: e.target.value })}
                          className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent"
                        />
                        <button type="button" className="text-xs text-fg-muted" onClick={() => patchLink(index, { icon_color: "" })}>
                          {t("bio.iconAuto")}
                        </button>
                      </span>
                    </span>
                  ) : null}
                </button>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{l.label || t("bio.addLink")}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {l.kind === "folder"
                      ? `${page.links.filter((x) => x.parent_id === l.id && x.kind !== "heading").length}`
                      : l.url || t(`bio.kind_${l.kind}`)}
                  </p>
                </div>
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
            );
          })}
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
              <Input value={s.url} placeholder="https://" onChange={(e) => {
                const url = e.target.value;
                const network = networkFromUrl(url);
                update({
                  ...page,
                  socials: page.socials.map((x, idx) => (idx === i ? { ...x, url, ...(network ? { network } : {}) } : x)),
                });
              }} />
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
