import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Folder,
  MousePointerClick,
  Plus,
  Trash2,
  Tag,
  BarChart3,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { useControlData } from "@/lib/docbay/use-control";
import { QuickShorten } from "@/components/control/quick-shorten";
import {
  createParamNode,
  updateParamNode,
  deleteParamNode,
  createTag,
  deleteTag,
  createUtmPreset,
  deleteUtmPreset,
} from "@/lib/docbay/api";
import type { FullState, ParamNode } from "@/lib/docbay/types";
import { cn } from "@/lib/utils";
import { ColorDots } from "@/components/control/tag-picker";
import { DEFAULT_TAG_COLOR } from "@/lib/docbay/tags";

export const Route = createFileRoute("/control/parameters")({
  component: ParametersPage,
});

function ParametersPage() {
  const data = useControlData();
  const router = useRouter();
  const [state, setState] = useState(data);
  const [addRoot, setAddRoot] = useState(false);
  const [addTag, setAddTag] = useState(false);
  const [addUtm, setAddUtm] = useState(false);

  useEffect(() => setState(data), [data]);

  async function refresh(s: FullState) {
    setState(s);
    await router.invalidate();
  }

  const roots = state.params
    .filter((n) => !n.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Parameter
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Ordner und Link-Gen-Buttons (z. B. Mitarbeiter). Stecken im Access-Token –
          nicht als Klartext in der URL.
        </p>
      </div>

      <QuickShorten />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Ordner & Buttons</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setAddRoot(true)}>
            <Plus className="h-3.5 w-3.5" /> Ordner
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {roots.length === 0 && (
            <p className="text-sm text-fg-muted">
              Noch keine Parameter. Lege z. B. den Ordner „Mitarbeiter“ an.
            </p>
          )}
          {roots.map((node) => (
            <ParamTree
              key={node.id}
              node={node}
              all={state.params}
              depth={0}
              onRefresh={refresh}
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" /> Tags
            </CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setAddTag(true)}>
              <Plus className="h-3.5 w-3.5" /> Tag
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {state.tags.length === 0 && (
                <p className="text-sm text-fg-muted">Noch keine Tags.</p>
              )}
              {state.tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-xs"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                  <button
                    type="button"
                    className="text-fg-subtle hover:text-danger"
                    onClick={async () => {
                      const s = await deleteTag({ data: { id: t.id } });
                      await refresh(s as FullState);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> UTM-Presets
            </CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setAddUtm(true)}>
              <Plus className="h-3.5 w-3.5" /> UTM
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {state.utmPresets.length === 0 && (
                <p className="text-sm text-fg-muted">Noch keine UTM-Presets.</p>
              )}
              {state.utmPresets.map((u) => (
                <li
                  key={u.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="font-mono text-[11px] text-fg-subtle">
                      {[u.utm_source, u.utm_medium, u.utm_campaign]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-fg-subtle hover:text-danger"
                    onClick={async () => {
                      const s = await deleteUtmPreset({ data: { id: u.id } });
                      await refresh(s as FullState);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {addRoot && (
        <NodeModal
          mode="create"
          kind="folder"
          parentId={null}
          onClose={() => setAddRoot(false)}
          onDone={async (s) => {
            await refresh(s);
            setAddRoot(false);
          }}
        />
      )}
      {addTag && (
        <TagModal
          onClose={() => setAddTag(false)}
          onDone={async (s) => {
            await refresh(s);
            setAddTag(false);
          }}
        />
      )}
      {addUtm && (
        <UtmModal
          onClose={() => setAddUtm(false)}
          onDone={async (s) => {
            await refresh(s);
            setAddUtm(false);
          }}
        />
      )}
    </div>
  );
}

function ParamTree({
  node,
  all,
  depth,
  onRefresh,
}: {
  node: ParamNode;
  all: ParamNode[];
  depth: number;
  onRefresh: (s: FullState) => Promise<void>;
}) {
  const children = all
    .filter((n) => n.parent_id === node.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const [modal, setModal] = useState<
    | { type: "create"; kind: "folder" | "button" }
    | { type: "rename" }
    | null
  >(null);

  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {node.kind === "folder" ? (
            <Folder className="h-4 w-4 shrink-0 text-warning" />
          ) : (
            <MousePointerClick className="h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{node.name}</p>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              <Badge variant="outline">
                {node.kind === "folder" ? "Ordner" : "Button"}
              </Badge>
              {node.kind === "button" && node.show_on_home && (
                <Badge variant="success">Startseite</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setModal({ type: "rename" })}>
            <Pencil className="h-3.5 w-3.5" /> Umbenennen
          </Button>
          {node.kind === "button" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const s = await updateParamNode({
                  data: { id: node.id, show_on_home: !node.show_on_home },
                });
                await onRefresh(s as FullState);
                toast.success(
                  node.show_on_home
                    ? "Von Startseite entfernt"
                    : "Auf Startseite anzeigen",
                );
              }}
            >
              {node.show_on_home ? "Von Startseite" : "Auf Startseite"}
            </Button>
          )}
          {node.kind === "folder" && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setModal({ type: "create", kind: "folder" })}
              >
                <Plus className="h-3.5 w-3.5" /> Unterordner
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setModal({ type: "create", kind: "button" })}
              >
                <Plus className="h-3.5 w-3.5" /> Button
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!confirm(`„${node.name}“ löschen?`)) return;
              const s = await deleteParamNode({ data: { id: node.id } });
              await onRefresh(s as FullState);
            }}
          >
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>
      {children.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border pl-2">
          {children.map((c) => (
            <ParamTree
              key={c.id}
              node={c}
              all={all}
              depth={depth + 1}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
      {modal?.type === "create" && (
        <NodeModal
          mode="create"
          kind={modal.kind}
          parentId={node.id}
          onClose={() => setModal(null)}
          onDone={async (s) => {
            await onRefresh(s);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "rename" && (
        <NodeModal
          mode="rename"
          kind={node.kind}
          parentId={node.parent_id}
          node={node}
          onClose={() => setModal(null)}
          onDone={async (s) => {
            await onRefresh(s);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function NodeModal({
  mode,
  kind,
  parentId,
  node,
  onClose,
  onDone,
}: {
  mode: "create" | "rename";
  kind: "folder" | "button";
  parentId: string | null;
  node?: ParamNode;
  onClose: () => void;
  onDone: (s: FullState) => Promise<void>;
}) {
  const [name, setName] = useState(node?.name ?? "");
  const [showOnHome, setShowOnHome] = useState(
    node?.show_on_home ?? kind === "button",
  );
  const [busy, setBusy] = useState(false);
  const kindLabel = kind === "folder" ? "Ordner" : "Button";
  const title =
    mode === "rename" ? `${kindLabel} umbenennen` : `${kindLabel} anlegen`;

  async function submit() {
    if (!name.trim()) {
      toast.error("Name erforderlich");
      return;
    }
    setBusy(true);
    try {
      if (mode === "rename" && node) {
        const s = await updateParamNode({
          data: {
            id: node.id,
            name: name.trim(),
            show_on_home: kind === "button" ? showOnHome : undefined,
          },
        });
        await onDone(s as FullState);
        toast.success("Umbenannt");
      } else {
        const s = await createParamNode({
          data: {
            name: name.trim(),
            kind,
            parent_id: parentId,
            show_on_home: kind === "button" ? showOnHome : false,
          },
        });
        await onDone(s as FullState);
        toast.success(`${kindLabel} angelegt`);
      }
    } catch {
      toast.error("Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenModal
      title={title}
      description={
        kind === "folder"
          ? "Name steckt nur intern im Token – nicht in der URL."
          : "Der Button erscheint beim Link-Generieren. Attribution bleibt im Hash."
      }
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "…" : mode === "rename" ? "Speichern" : "Anlegen"}
          </Button>
        </>
      }
    >
      <div>
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "folder" ? "Mitarbeiter" : "Tom"}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </div>
      {kind === "button" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showOnHome}
            onChange={(e) => setShowOnHome(e.target.checked)}
          />
          Auf Startseite anzeigen
        </label>
      )}
    </FullScreenModal>
  );
}

function TagModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (s: FullState) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Name erforderlich");
      return;
    }
    setBusy(true);
    try {
      const s = await createTag({ data: { name: name.trim(), color } });
      await onDone(s as FullState);
      toast.success("Tag angelegt");
    } catch {
      toast.error("Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenModal
      title="Tag anlegen"
      description="Tags hängen intern am Token, nicht als Klartext in der URL."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button className="min-h-11" disabled={busy} onClick={() => void submit()}>
            {busy ? "…" : "Anlegen"}
          </Button>
        </>
      }
    >
      <div>
        <Label>Tag</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="interessent"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <div className="mt-3">
          <Label>Farbe</Label>
          <ColorDots value={color} onChange={setColor} />
        </div>
      </div>
    </FullScreenModal>
  );
}

function UtmModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (s: FullState) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Preset-Name erforderlich");
      return;
    }
    setBusy(true);
    try {
      const s = await createUtmPreset({
        data: {
          name: name.trim(),
          utm_source: source || undefined,
          utm_medium: medium || undefined,
          utm_campaign: campaign || undefined,
        },
      });
      await onDone(s as FullState);
      toast.success("UTM-Preset angelegt");
    } catch {
      toast.error("Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullScreenModal
      title="UTM-Preset anlegen"
      description="Nur UTM erscheint im Klartext der URL – Attribution bleibt im Token."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button className="min-h-11" disabled={busy} onClick={() => void submit()}>
            {busy ? "…" : "Anlegen"}
          </Button>
        </>
      }
    >
      <div>
        <Label>Preset-Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="LinkedIn Kampagne"
          autoFocus
        />
      </div>
      <div>
        <Label>utm_source</Label>
        <Input
          className="font-mono"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="linkedin"
        />
      </div>
      <div>
        <Label>utm_medium</Label>
        <Input
          className="font-mono"
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          placeholder="social"
        />
      </div>
      <div>
        <Label>utm_campaign</Label>
        <Input
          className="font-mono"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="q3-markisen"
        />
      </div>
    </FullScreenModal>
  );
}
