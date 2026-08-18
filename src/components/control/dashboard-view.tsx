import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Frame,
  GripVertical,
  Link2,
  MousePointerClick,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HueButton } from "@/components/ui/hue-button";
import { useControl } from "@/lib/docbay/control-store";
import {
  addDashTeamSection,
  createDashTeam,
  deleteDashGroup,
  deleteDashWidget,
  moveDashSection,
  saveDashGroup,
  saveDashSettings,
  saveDashWidget,
} from "@/lib/docbay/dashboard-api";
import { hueStyle } from "@/lib/docbay/palette";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DashGroup, DashSection, DashState, DashWidget, FullState, ShortLink } from "@/lib/docbay/types";
import { ColorPicker } from "./color-picker";
import { useOpenCreate } from "@/lib/docbay/use-control";

const COLS = 12;
const ROW = 72;

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

  const above = dash.sections.filter((s) => s.zone === "above");
  const personal = dash.sections.filter((s) => s.zone === "personal");
  const below = dash.sections.filter((s) => s.zone === "below");

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t("dash.title")}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t("dash.hint")}</p>
        </div>
        {admin && (
          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 rounded-md border border-border bg-bg-elevated px-2 text-sm"
              value={dash.user_buttons}
              onChange={(e) =>
                void run(() =>
                  saveDashSettings({
                    data: {
                      tenant_id: data.tenant.id,
                      user_buttons: e.target.value as DashState["user_buttons"],
                    },
                  }),
                )
              }
            >
              <option value="off">{t("dash.userOff")}</option>
              <option value="anywhere">{t("dash.userAny")}</option>
              <option value="above">{t("dash.userAbove")}</option>
              <option value="below">{t("dash.userBelow")}</option>
            </select>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const name = window.prompt(t("dash.teamName"), "Team");
                if (name)
                  void run(() =>
                    createDashTeam({ data: { name, tenant_id: data.tenant.id } }),
                  );
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {t("dash.newTeam")}
            </Button>
          </div>
        )}
      </div>

      {admin && dash.active_team_id && (
        <div className="flex flex-wrap gap-2">
          {!above.length && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void run(() =>
                  addDashTeamSection({
                    data: { team_id: dash.active_team_id!, zone: "above", tenant_id: data.tenant.id },
                  }),
                )
              }
            >
              {t("dash.addAbove")}
            </Button>
          )}
          {!below.length && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void run(() =>
                  addDashTeamSection({
                    data: { team_id: dash.active_team_id!, zone: "below", tenant_id: data.tenant.id },
                  }),
                )
              }
            >
              {t("dash.addBelow")}
            </Button>
          )}
        </div>
      )}

      {[...above, ...personal, ...below].map((sec) => (
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
    sec.kind === "personal"
      ? dash.user_buttons !== "off"
      : admin || dash.user_buttons === "anywhere";

  const rows = Math.max(
    4,
    ...widgets.map((w) => w.y + w.h),
    ...groups.map((g) => g.y + g.h),
    4,
  );

  return (
    <section className="dash-section overflow-hidden rounded-xl p-3" style={hueStyle(hue)}>
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
  const [open, setOpen] = useState(false);
  return (
    <div
      className="absolute rounded-lg border-2"
      style={{
        left: `${(g.x / COLS) * 100}%`,
        top: g.y * ROW,
        width: `${(g.w / COLS) * 100}%`,
        height: g.h * ROW,
        borderColor: g.color,
        background: `${g.color}14`,
      }}
    >
      <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px]" style={{ color: g.color }}>
        <span className="min-w-0 truncate">{g.title || " "}</span>
        <button
          type="button"
          className="h-3.5 w-3.5 rounded-full border border-current"
          style={{ background: g.color }}
          onClick={() => setOpen((v) => !v)}
        />
        <button type="button" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="absolute left-2 right-2 z-10 rounded-md border border-border bg-bg-elevated p-2 shadow-lg">
          <ColorPicker
            value={g.color}
            onChange={(color) => {
              void saveDashGroup({
                data: {
                  id: g.id,
                  section_id: g.section_id,
                  title: g.title,
                  color,
                  x: g.x,
                  y: g.y,
                  w: g.w,
                  h: g.h,
                  tenant_id: tenantId,
                },
              }).then(onApply);
            }}
          />
        </div>
      )}
    </div>
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

  function cell(e: React.PointerEvent) {
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
          className="pointer-events-none absolute rounded-lg border border-dashed border-fg/40 bg-fg/5"
          style={{
            left: `${(draft.x / COLS) * 100}%`,
            top: draft.y * ROW,
            width: `${(draft.w / COLS) * 100}%`,
            height: draft.h * ROW,
          }}
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
  const drag = useRef<{
    px: number;
    py: number;
    x: number;
    y: number;
    w: number;
    h: number;
    mode: "move" | "resize";
  } | null>(null);
  const [geom, setGeom] = useState({ x: w.x, y: w.y, w: w.w, h: w.h });
  const [cfg, setCfg] = useState(false);
  const cells = geom.w * geom.h;
  const url = short ? `https://${host}/${short.slug}` : "";

  useEffect(() => {
    setGeom({ x: w.x, y: w.y, w: w.w, h: w.h });
  }, [w.x, w.y, w.w, w.h]);

  function start(e: React.PointerEvent, mode: "move" | "resize") {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: geom.x, y: geom.y, w: geom.w, h: geom.h, mode };
  }

  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    const parent = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    if (!parent) return;
    const cw = parent.getBoundingClientRect().width / COLS;
    const dx = (e.clientX - drag.current.px) / cw;
    const dy = (e.clientY - drag.current.py) / ROW;
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
    if (!drag.current) return;
    drag.current = null;
    onChange({ ...w, ...geom });
  }

  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-sm"
      style={{
        left: `${(geom.x / COLS) * 100}%`,
        top: geom.y * ROW,
        width: `${(geom.w / COLS) * 100}%`,
        height: geom.h * ROW - 6,
      }}
      onPointerMove={move}
      onPointerUp={end}
    >
      <div
        className="flex cursor-grab items-center gap-1 border-b border-border px-2 py-1 text-[11px] text-fg-muted active:cursor-grabbing"
        onPointerDown={(e) => start(e, "move")}
      >
        <GripVertical className="h-3 w-3" />
        <span className="min-w-0 flex-1 truncate">{w.label || short?.slug || "Button"}</span>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCfg((v) => !v)}>
          <Settings2 className="h-3 w-3" />
        </button>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {cfg ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-2 text-[11px]" onPointerDown={(e) => e.stopPropagation()}>
          <input
            className="h-7 rounded border border-border bg-bg px-1.5"
            value={w.label}
            onChange={(e) => onChange({ ...w, label: e.target.value })}
          />
          <select
            className="h-7 rounded border border-border bg-bg px-1"
            value={w.display}
            onChange={(e) =>
              onChange({ ...w, display: e.target.value as DashWidget["display"] })
            }
          >
            <option value="text">{t("dash.asText")}</option>
            <option value="icon">{t("dash.asIcon")}</option>
            <option value="preview">{t("dash.asPreview")}</option>
          </select>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={w.show_clicks}
              onChange={(e) => onChange({ ...w, show_clicks: e.target.checked })}
            />
            {t("dash.showClicks")}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={w.show_last_click}
              onChange={(e) => onChange({ ...w, show_last_click: e.target.checked })}
            />
            {t("dash.showLast")}
          </label>
        </div>
      ) : (
        <button
          type="button"
          className="flex min-h-0 flex-1 flex-col items-start justify-center gap-1 p-2 text-left"
          onClick={() => {
            if (!url) return;
            void navigator.clipboard.writeText(url);
            toast.success(t("dash.copied"));
          }}
        >
          {w.display === "preview" && (w.image_url || short?.og_image) && cells >= 4 && (
            <img
              src={w.image_url || short?.og_image || ""}
              alt=""
              className="mb-1 h-12 w-full rounded object-cover"
            />
          )}
          <span className="inline-flex items-center gap-1 text-sm font-medium">
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
        </button>
      )}
      <button
        type="button"
        className="absolute bottom-0.5 right-0.5 h-3 w-3 cursor-se-resize rounded-sm bg-border"
        onPointerDown={(e) => start(e, "resize")}
      />
    </div>
  );
}
