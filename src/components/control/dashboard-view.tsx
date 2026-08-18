import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Frame,
  Link2,
  MousePointerClick,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HueButton } from "@/components/ui/hue-button";
import { useControl } from "@/lib/docbay/control-store";
import { createShort } from "@/lib/docbay/shorts-api";
import { upsertShort } from "@/lib/docbay/state-patch";
import { Input, Textarea, Label } from "@/components/ui/input";
import {
  deleteDashGroup,
  deleteDashWidget,
  getDash,
  moveDashSection,
  saveDashGroup,
  saveDashWidget,
} from "@/lib/docbay/dashboard-api";
import { hueStyle } from "@/lib/docbay/palette";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DashGroup, DashSection, DashState, DashWidget, FullState, ShortLink } from "@/lib/docbay/types";
import { ColorPicker } from "./color-picker";
import { useOpenCreate } from "@/lib/docbay/use-control";

const COLS = 12;
const ROW = 80;
const GAP = 16;

function cellStyle(x: number, y: number, w: number, h: number, inset: number): CSSProperties {
  return {
    left: `calc(${(x / COLS) * 100}% + ${inset}px)`,
    top: y * ROW + inset,
    width: `calc(${(w / COLS) * 100}% - ${inset * 2}px)`,
    height: h * ROW - inset * 2,
  };
}

function snap(n: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function DashboardView() {
  const t = useT();
  const { data, setData } = useControl();
  const openCreate = useOpenCreate();
  const dash = data.dash ?? {
    user_buttons: "anywhere" as const,
    teams: [],
    active_team_id: null,
    sections: [],
    groups: [],
    widgets: [],
  };
  const admin = data.member.role !== "member";
  const [askMerge, setAskMerge] = useState<{ id: string; zone: "above" | "below" } | null>(null);
  const [draw, setDraw] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);

  function apply(next: DashState) {
    setData({
      ...data,
      dash: next,
      tenant: { ...data.tenant, dash_user_buttons: next.user_buttons },
    });
  }

  async function run(fn: () => Promise<DashState>) {
    try {
      apply(await fn());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  const shortsById = useMemo(() => {
    const m = new Map<string, ShortLink>();
    for (const s of data.shorts) m.set(s.id, s);
    return m;
  }, [data.shorts]);

  const above = dash.sections.filter((s) => s.kind === "team" && s.zone === "above");
  const personal = dash.sections.filter((s) => s.kind === "personal");
  const below = dash.sections.filter((s) => s.kind === "team" && s.zone === "below");
  const ordered =
    dash.user_buttons === "above"
      ? [...personal, ...above, ...below]
      : dash.user_buttons === "below"
        ? [...above, ...below, ...personal]
        : [...above, ...personal, ...below];
  const team = dash.teams.find((t) => t.id === dash.active_team_id) || dash.teams[0];
  const visibleTeams = admin
    ? dash.teams
    : dash.teams.filter((t) => t.member_ids.includes(data.member.user_id));

  async function move(sec: DashSection, zone: "above" | "below") {
    const clash = dash.sections.some((s) => s.kind === "team" && s.zone === zone && s.id !== sec.id);
    if (clash) {
      setAskMerge({ id: sec.id, zone });
      return;
    }
    await run(() =>
      moveDashSection({ data: { id: sec.id, zone, tenant_id: data.tenant.id } }),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {visibleTeams.length > 1 && (
        <div className="flex justify-end">
          <select
            className="h-9 rounded-md border border-border bg-bg-elevated px-2 text-sm"
            value={team?.id || ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              void run(() => getDash({ data: { tenant_id: data.tenant.id, team_id: id } }));
            }}
          >
            {visibleTeams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {ordered.map((sec) => (
        <SectionBoard
          key={sec.id}
          sec={sec}
          dash={dash}
          data={data}
          shortsById={shortsById}
          admin={admin}
          drawing={draw === sec.id}
          onDraw={() => setDraw((c) => (c === sec.id ? null : sec.id))}
          onMove={move}
          onApply={apply}
          onPick={() => setPickFor(sec.id)}
        />
      ))}

      {pickFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-xl">
            <p className="text-sm font-medium">{t("dash.pickLink")}</p>
            <ul className="max-h-64 overflow-y-auto">
              {data.shorts.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-bg-subtle"
                    onClick={() => {
                      void run(async () => {
                        const pos = {
                          x: 0,
                          y: Math.max(
                            0,
                            ...dash.widgets
                              .filter((w) => w.section_id === pickFor)
                              .map((w) => w.y + w.h),
                          ),
                        };
                        return saveDashWidget({
                          data: {
                            tenant_id: data.tenant.id,
                            section_id: pickFor,
                            short_id: s.id,
                            label: s.title || s.slug,
                            display: "text",
                            show_clicks: true,
                            show_last_click: false,
                            ...pos,
                            w: 2,
                            h: 2,
                          },
                        });
                      });
                      setPickFor(null);
                    }}
                  >
                    <span className="truncate">{s.title || s.slug}</span>
                    <span className="font-mono text-[11px] text-fg-subtle">/{s.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPickFor(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setPickFor(null);
                  openCreate();
                }}
              >
                {t("short.newLink")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {askMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-xl">
            <p className="text-sm">{t("dash.mergeAsk")}</p>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void run(() =>
                    moveDashSection({
                      data: {
                        id: askMerge.id,
                        zone: askMerge.zone,
                        merge: false,
                        tenant_id: data.tenant.id,
                      },
                    }),
                  );
                  setAskMerge(null);
                }}
              >
                {t("dash.mergeNo")}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void run(() =>
                    moveDashSection({
                      data: {
                        id: askMerge.id,
                        zone: askMerge.zone,
                        merge: true,
                        tenant_id: data.tenant.id,
                      },
                    }),
                  );
                  setAskMerge(null);
                }}
              >
                {t("dash.mergeYes")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionBoard({
  sec,
  dash,
  data,
  shortsById,
  admin,
  drawing,
  onDraw,
  onMove,
  onApply,
  onPick,
}: {
  sec: DashSection;
  dash: DashState;
  data: FullState;
  shortsById: Map<string, ShortLink>;
  admin: boolean;
  drawing: boolean;
  onDraw: () => void;
  onMove: (s: DashSection, z: "above" | "below") => void;
  onApply: (s: DashState) => void;
  onPick: () => void;
}) {
  const t = useT();
  const widgets = dash.widgets.filter((w) => w.section_id === sec.id);
  const groups = dash.groups.filter((g) => g.section_id === sec.id);
  const hue = sec.kind === "team" ? "teal" : "azure";
  const canAdd =
    sec.kind === "team" ? admin : admin || dash.user_buttons !== "off";

  const rows = Math.max(
    4,
    ...widgets.map((w) => w.y + w.h),
    ...groups.map((g) => g.y + g.h),
    4,
  );

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl p-3",
        sec.kind === "personal"
          ? "border border-border bg-transparent"
          : "dash-section",
      )}
      style={sec.kind === "personal" ? undefined : hueStyle(hue)}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-medium">
          {sec.kind === "team" ? sec.title || t("dash.teamBlock") : t("dash.personal")}
        </p>
        {sec.kind === "team" && admin && (
          <>
            <button type="button" className="text-fg-muted hover:text-fg" onClick={() => onMove(sec, "above")}>
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" className="text-fg-muted hover:text-fg" onClick={() => onMove(sec, "below")}>
              <ArrowDown className="h-4 w-4" />
            </button>
          </>
        )}
        {canAdd && (
          <>
            <Button size="sm" variant="ghost" onClick={onDraw}>
              <Frame className="h-3.5 w-3.5" /> {drawing ? t("dash.drawing") : t("dash.group")}
            </Button>
            <HueButton hue={hue} size="sm" onClick={onPick}>
              <Plus className="h-3.5 w-3.5" /> {t("dash.addBtn")}
            </HueButton>
          </>
        )}
      </div>
      <Grid
        rows={rows}
        drawing={drawing}
        groups={groups}
        widgets={widgets}
        shortsById={shortsById}
        data={data}
        onDrawDone={async (box) => {
          onDraw();
          onApply(
            await saveDashGroup({
              data: { ...box, section_id: sec.id, tenant_id: data.tenant.id },
            }),
          );
        }}
        onWidget={async (w) => {
          onApply(
            await saveDashWidget({
              data: { ...w, section_id: sec.id, tenant_id: data.tenant.id },
            }),
          );
        }}
        onDeleteWidget={async (id) => {
          onApply(await deleteDashWidget({ data: { id, tenant_id: data.tenant.id } }));
        }}
        onDeleteGroup={async (id) => {
          onApply(await deleteDashGroup({ data: { id, tenant_id: data.tenant.id } }));
        }}
        onApply={onApply}
      />
    </section>
  );
}

function GroupFrame({
  g,
  tenantId,
  onApply,
  onDelete,
}: {
  g: DashGroup;
  tenantId: string;
  onApply: (s: DashState) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(g.title);
  const [color, setColor] = useState(g.color);
  const hold = useRef(0);

  useEffect(() => {
    setTitle(g.title);
    setColor(g.color);
  }, [g.title, g.color]);

  function clearHold() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = 0;
  }

  function openModal() {
    clearHold();
    setTitle(g.title);
    setColor(g.color);
    setOpen(true);
  }

  async function save() {
    onApply(
      await saveDashGroup({
        data: {
          id: g.id,
          section_id: g.section_id,
          title,
          color,
          x: g.x,
          y: g.y,
          w: g.w,
          h: g.h,
          tenant_id: tenantId,
        },
      }),
    );
    setOpen(false);
  }

  return (
    <>
      <div
        className="dash-group absolute rounded-xl border-2"
        style={{
          ...cellStyle(g.x, g.y, g.w, g.h, 0),
          borderColor: g.color,
          ["--hue"]: g.color,
        } as CSSProperties}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openModal();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          clearHold();
          hold.current = window.setTimeout(openModal, 480);
        }}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
      >
        {g.title ? (
          <span
            className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 rounded-sm bg-bg-elevated px-1.5 text-[10px] font-medium"
            style={{ color: g.color }}
          >
            {g.title}
          </span>
        ) : null}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-xl">
            <p className="text-sm font-medium">{t("dash.groupTitle")}</p>
            <div>
              <Label>{t("dash.groupName")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>{t("dash.groupColor")}</Label>
              <div className="mt-1.5">
                <ColorPicker value={color} onChange={setColor} />
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <Button size="sm" variant="danger" onClick={() => { onDelete(); setOpen(false); }}>
                <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={() => void save()}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Grid({
  rows,
  drawing,
  groups,
  widgets,
  shortsById,
  data,
  onDrawDone,
  onWidget,
  onDeleteWidget,
  onDeleteGroup,
  onApply,
}: {
  rows: number;
  drawing: boolean;
  groups: DashState["groups"];
  widgets: DashWidget[];
  shortsById: Map<string, ShortLink>;
  data: FullState;
  onDrawDone: (b: { x: number; y: number; w: number; h: number }) => void;
  onWidget: (w: DashWidget) => void;
  onDeleteWidget: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onApply: (s: DashState) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  function cell(e: PointerEvent) {
    const box = ref.current!.getBoundingClientRect();
    const cw = box.width / COLS;
    const x = snap((e.clientX - box.left) / cw, COLS - 1);
    const y = snap((e.clientY - box.top) / ROW, 40);
    return { x, y };
  }

  return (
    <div
      ref={ref}
      className={cn("relative min-h-[12rem] rounded-lg", drawing && "cursor-crosshair")}
      style={{ height: rows * ROW }}
      onPointerDown={(e) => {
        if (!drawing) return;
        const a = cell(e);
        setDraft({ ...a, w: 1, h: 1 });
      }}
      onPointerMove={(e) => {
        if (!draft) return;
        const b = cell(e);
        setDraft({
          x: Math.min(draft.x, b.x),
          y: Math.min(draft.y, b.y),
          w: Math.max(1, Math.abs(b.x - draft.x) + 1),
          h: Math.max(1, Math.abs(b.y - draft.y) + 1),
        });
      }}
      onPointerUp={() => {
        if (draft && (draft.w > 1 || draft.h > 1)) onDrawDone(draft);
        setDraft(null);
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--color-border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-border) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: `${100 / COLS}% ${ROW}px`,
        }}
      />
      {groups.map((g) => (
        <GroupFrame
          key={g.id}
          g={g}
          tenantId={data.tenant.id}
          onApply={onApply}
          onDelete={() => onDeleteGroup(g.id)}
        />
      ))}
      {draft && (
        <div
          className="pointer-events-none absolute rounded-xl border border-dashed border-fg/40 bg-fg/5"
          style={cellStyle(draft.x, draft.y, draft.w, draft.h, 0)}
        />
      )}
      {widgets.map((w) => (
        <WidgetCard
          key={w.id}
          w={w}
          short={w.short_id ? shortsById.get(w.short_id) : undefined}
          host={data.tenant.public_host}
          onChange={onWidget}
          onDelete={() => onDeleteWidget(w.id)}
        />
      ))}
    </div>
  );
}

function WidgetCard({
  w,
  short,
  host,
  onChange,
  onDelete,
}: {
  w: DashWidget;
  short?: ShortLink;
  host: string;
  onChange: (w: DashWidget) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const { data, setData } = useControl();
  const drag = useRef<{
    px: number;
    py: number;
    x: number;
    y: number;
    w: number;
    h: number;
    mode: "move" | "resize";
  } | null>(null);
  const hold = useRef<number>(0);
  const moved = useRef(false);
  const [geom, setGeom] = useState({ x: w.x, y: w.y, w: w.w, h: w.h });
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState(w);
  const [mint, setMint] = useState<"form" | { url: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cells = geom.w * geom.h;
  const url = short ? `https://${host}/${short.slug}` : "";
  const mode = w.click_mode === "mint" ? "mint" : "copy";

  useEffect(() => {
    setGeom({ x: w.x, y: w.y, w: w.w, h: w.h });
    setDraft(w);
  }, [w]);

  function clearHold() {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = 0;
  }

  function start(e: PointerEvent, kind: "move" | "resize") {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moved.current = false;
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      x: geom.x,
      y: geom.y,
      w: geom.w,
      h: geom.h,
      mode: kind,
    };
    if (kind === "move") {
      clearHold();
      hold.current = window.setTimeout(() => {
        if (!moved.current) {
          drag.current = null;
          setSettings(true);
        }
      }, 480);
    }
  }

  function move(e: PointerEvent) {
    if (!drag.current) return;
    const parent = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    if (!parent) return;
    const dxPx = e.clientX - drag.current.px;
    const dyPx = e.clientY - drag.current.py;
    if (!moved.current && Math.hypot(dxPx, dyPx) < 7) return;
    moved.current = true;
    clearHold();
    const cw = parent.getBoundingClientRect().width / COLS;
    const dx = dxPx / cw;
    const dy = dyPx / ROW;
    if (drag.current.mode === "move") {
      setGeom((g) => ({
        ...g,
        x: snap(drag.current!.x + dx, COLS - g.w),
        y: snap(drag.current!.y + dy, 40),
      }));
    } else {
      setGeom((g) => ({
        ...g,
        w: snap(drag.current!.w + dx, COLS - g.x) || 1,
        h: snap(drag.current!.h + dy, 12) || 1,
      }));
    }
  }

  function end() {
    clearHold();
    const wasDrag = Boolean(drag.current) && moved.current;
    const wasClick = Boolean(drag.current) && !moved.current && drag.current?.mode === "move";
    drag.current = null;
    if (wasDrag) onChange({ ...w, ...geom });
    if (wasClick) void onActivate();
  }

  async function onActivate() {
    if (mode === "mint") {
      setNote("");
      setMint("form");
      return;
    }
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success(t("dash.copied"));
  }

  async function mintLink() {
    if (!short) return;
    setBusy(true);
    try {
      const created = await createShort({
        data: {
          destination: short.destination,
          title: short.title || w.label,
          note: note.trim(),
          tags: short.tags,
          ios_url: short.ios_url || undefined,
          android_url: short.android_url || undefined,
          og_title: short.og_title || undefined,
          og_description: short.og_description || undefined,
          og_image: short.og_image || undefined,
          button_id: short.button_id,
          utm_source: short.utm_source || undefined,
          utm_medium: short.utm_medium || undefined,
          utm_campaign: short.utm_campaign || undefined,
          tenant_id: data.tenant.id,
        },
      });
      setData(upsertShort(data, created.short));
      const next = `https://${host}/${created.short.slug}`;
      await navigator.clipboard.writeText(next);
      setMint({ url: next });
      toast.success(t("dash.mintReady"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  function saveSettings() {
    onChange({ ...draft, ...geom });
    setSettings(false);
  }

  return (
    <>
      <div
        className="absolute flex flex-col overflow-hidden rounded-lg border bg-bg-elevated shadow-sm"
        style={{
          ...cellStyle(geom.x, geom.y, geom.w, geom.h, GAP / 2),
          borderColor: w.color || undefined,
          background: w.color ? `${w.color}18` : undefined,
        }}
        onPointerDown={(e) => start(e, "move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={clearHold}
        onContextMenu={(e) => {
          e.preventDefault();
          clearHold();
          drag.current = null;
          setDraft(w);
          setSettings(true);
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-1 p-2 text-left">
          {w.display === "preview" && (w.image_url || short?.og_image) && cells >= 4 && (
            <img
              src={w.image_url || short?.og_image || ""}
              alt=""
              className="pointer-events-none mb-1 h-12 w-full rounded object-cover"
            />
          )}
          <span
            className="inline-flex items-center gap-1 text-sm font-medium"
            style={w.color ? { color: w.color } : undefined}
          >
            {(w.display === "icon" || cells <= 2) && <Link2 className="h-4 w-4 text-hue-azure" />}
            {w.display !== "icon" && (
              <span className="truncate">{w.label || short?.title || short?.slug}</span>
            )}
          </span>
          {w.show_clicks && cells >= 4 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
              <MousePointerClick className="h-3 w-3" /> {short?.click_count ?? 0}
            </span>
          )}
          {w.show_last_click && cells >= 6 && short?.last_clicked_at && (
            <span className="text-[11px] text-fg-subtle">
              {t("dash.lastClick")} {short.last_clicked_at.slice(0, 16)}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="resize"
          className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 cursor-se-resize rounded-full bg-fg/35"
          onPointerDown={(e) => start(e, "resize")}
        />
      </div>

      {settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-xl">
            <p className="text-sm font-medium">{t("dash.settingsTitle")}</p>
            <div>
              <Label>{t("dash.buttonText")}</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div>
              <Label>{t("dash.buttonColor")}</Label>
              <div className="mt-1.5">
                <ColorPicker
                  value={draft.color || "#64748b"}
                  onChange={(color) => setDraft({ ...draft, color })}
                />
              </div>
            </div>
            <div>
              <Label>{t("dash.settings")}</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={draft.display}
                onChange={(e) =>
                  setDraft({ ...draft, display: e.target.value as DashWidget["display"] })
                }
              >
                <option value="text">{t("dash.asText")}</option>
                <option value="icon">{t("dash.asIcon")}</option>
                <option value="preview">{t("dash.asPreview")}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.show_clicks}
                onChange={(e) => setDraft({ ...draft, show_clicks: e.target.checked })}
              />
              {t("dash.showClicks")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.show_last_click}
                onChange={(e) => setDraft({ ...draft, show_last_click: e.target.checked })}
              />
              {t("dash.showLast")}
            </label>
            <div>
              <Label>{t("dash.settingsTitle")}</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={draft.click_mode || "copy"}
                onChange={(e) =>
                  setDraft({ ...draft, click_mode: e.target.value as DashWidget["click_mode"] })
                }
              >
                <option value="copy">{t("dash.clickCopy")}</option>
                <option value="mint">{t("dash.clickMint")}</option>
              </select>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <Button size="sm" variant="danger" onClick={() => { onDelete(); setSettings(false); }}>
                <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSettings(false)}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={saveSettings}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-bg-elevated p-4 shadow-xl">
            {mint === "form" ? (
              <>
                <p className="text-sm font-medium">{t("dash.clickMint")}</p>
                <div>
                  <Label>{t("dash.mintNote")}</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setMint(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => void mintLink()}>
                    {busy ? t("common.loading") : t("dash.mintSave")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">{t("dash.mintReady")}</p>
                <p className="break-all font-mono text-sm">{mint.url}</p>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setMint(null)}>
                    {t("common.close")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
