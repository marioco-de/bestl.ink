import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText,
  Globe,
  Pencil,
  Plus,
  Trash2,
  Link2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HueButton } from "@/components/ui/hue-button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { GeneratePanel } from "@/components/hashport/generate-panel";
import { useControlData, useSetControlData } from "@/lib/docbay/use-control";
import { createResource, deleteResource, updateResource, uploadBegin, uploadChunk, createTag } from "@/lib/docbay/api";
import { formatBytes, slugify } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/docbay/upload";
import type { FullState, Resource } from "@/lib/docbay/types";
import { TagChip, TagPicker } from "@/components/control/tag-picker";
import { tagColor } from "@/lib/docbay/tags";
import { DocActionPicker } from "@/components/control/doc-action-picker";
import { actionsPayload, parseChatMode, parseDocActions, withChatMode, type ChatMode, type DocAction } from "@/lib/docbay/doc-actions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/control/resources")({
  validateSearch: (s: Record<string, unknown>) => ({
    generate: typeof s.generate === "string" ? s.generate : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/control/links",
      search: {
        tab: "docs",
        generate: search.generate,
      } as never,
    });
  },
  component: () => null,
});

export function ResourcesWorkspace({
  typeFilter,
  hideChrome,
}: {
  typeFilter?: "document" | "page";
  hideChrome?: boolean;
}) {
  const data = useControlData();
  const setGlobal = useSetControlData();
  const t = useT();
  const [state, setState] = useState<FullState>(data);
  const [formFor, setFormFor] = useState<Resource | "new" | null>(null);
  const [generateFor, setGenerateFor] = useState<Resource | null>(null);

  useEffect(() => {
    setState(data);
  }, [data]);

  async function refresh(s: FullState) {
    setState(s);
    setGlobal?.(s);
  }

  const items = typeFilter
    ? state.resources.filter((r) => r.type === typeFilter)
    : state.resources;

  return (
    <div className={hideChrome ? "space-y-4" : "mx-auto max-w-4xl space-y-6"}>
      {!hideChrome && (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Inhalte
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Dokumente und Webseiten – ohne Token nur „Zugriff anfragen“.
          </p>
        </div>
        <Button onClick={() => setFormFor("new")}>
          <Plus className="h-4 w-4" /> Inhalt hinzufügen
        </Button>
      </div>
      )}
      {hideChrome && (
        <div className="flex justify-end">
          <HueButton
            hue={typeFilter === "page" ? "lime" : "violet"}
            size="sm"
            onClick={() => setFormFor("new")}
          >
            <Plus className="h-4 w-4" />{" "}
            {typeFilter === "page" ? "Seite" : "Dokument"}
          </HueButton>
        </div>
      )}

      {formFor && (
        <ResourceForm
          tenantId={state.tenant.id}
          defaultType={typeFilter === "page" ? "page" : "document"}
          initial={formFor === "new" ? undefined : formFor}
          onCancel={() => setFormFor(null)}
          onCreated={async (s) => {
            await refresh(s as FullState);
            setFormFor(null);
            toast.success(formFor === "new" ? "Inhalt angelegt" : t("common.saved"));
          }}
        />
      )}

      <div className="space-y-3">
        {items.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bg-muted text-fg-muted">
                  {r.type === "document" ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <Globe className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.title}</p>
                    <Badge variant="secondary">
                      {r.type === "document" ? "Dokument" : "Webseite"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-fg-subtle">
                    /{r.slug}
                    {r.type === "page" ? "/" : ""}
                  </p>
                  {r.description && (
                    <p className="mt-1 text-sm text-fg-muted line-clamp-2">
                      {r.description}
                    </p>
                  )}
                  {(r.tags?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.tags.map((n) => (
                        <TagChip key={n} name={n} color={tagColor(n, state.tags)} on />
                      ))}
                    </div>
                  )}
                  {r.type === "document" && (
                    <p className="mt-1 text-xs text-fg-subtle">
                      {r.file_name || "Datei"} · {formatBytes(r.file_size)}
                    </p>
                  )}
                  {r.type === "page" && r.content_url && (
                    <p className="mt-1 truncate text-xs text-fg-subtle">
                      Frame → {r.content_url}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => setFormFor(r)}>
                  <Pencil className="h-4 w-4" /> {t("common.edit")}
                </Button>
                <Button size="sm" onClick={() => setGenerateFor(r)}>
                  <Link2 className="h-4 w-4" /> Link generieren
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm("Inhalt wirklich löschen?")) return;
                    const s = await deleteResource({ data: { id: r.id } });
                    await refresh(s as FullState);
                    toast.success("Gelöscht");
                  }}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {generateFor && (
        <GeneratePanel
          resource={generateFor}
          state={state}
          onClose={() => {
            setGenerateFor(null);
          }}
          onUpdated={(s) => {
            void refresh(s);
          }}
        />
      )}
    </div>
  );
}

function ResourceForm({
  tenantId,
  defaultType = "document",
  initial,
  onCancel,
  onCreated,
}: {
  tenantId: string;
  defaultType?: "document" | "page";
  initial?: Resource;
  onCancel: () => void;
  onCreated: (s: FullState) => void;
}) {
  const catalog = useControlData().tags;
  const t = useT();
  const editing = Boolean(initial);
  const [type, setType] = useState<"document" | "page">(initial?.type === "page" ? "page" : defaultType);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pageUrl, setPageUrl] = useState(initial?.content_url ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [actions, setActions] = useState<DocAction[]>(() => parseDocActions(initial?.payload));
  const [chatMode, setChatMode] = useState<ChatMode>(() => parseChatMode(initial?.payload));
  const [file, setFile] = useState<{
    raw: File;
    name: string;
    mime: string;
    size: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  function onTitle(v: string) {
    setTitle(v);
    if (!slugTouched) {
      const base = slugify(v);
      setSlug(type === "document" ? `${base || "dokument"}.pdf` : base || "seite");
    }
  }

  function onFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error(`Max. ${MAX_UPLOAD_LABEL} pro Datei`);
      return;
    }
    setFile({
      raw: f,
      name: f.name,
      mime: f.type || "application/octet-stream",
      size: f.size,
    });
    if (!slugTouched) {
      setSlug(f.name.toLowerCase().replace(/\s+/g, "-"));
    }
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  function bytesToBase64(bytes: Uint8Array): string {
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function uploadFile(f: File): Promise<string> {
    const started = await uploadBegin({
      data: {
        file_name: f.name,
        mime_type: f.type || "application/octet-stream",
        file_size: f.size,
        tenant_id: tenantId,
      },
    });
    const uploadId = started.upload_id;
    const buf = new Uint8Array(await f.arrayBuffer());
    const chunkSize = 512 * 1024;
    for (let offset = 0; offset < buf.length; offset += chunkSize) {
      const slice = buf.subarray(offset, Math.min(offset + chunkSize, buf.length));
      await uploadChunk({
        data: {
          upload_id: uploadId,
          data: bytesToBase64(slice),
          tenant_id: tenantId,
        },
      });
      setProgress(Math.min(99, Math.round(((offset + slice.length) / buf.length) * 100)));
    }
    setProgress(100);
    return uploadId;
  }

  async function submit() {
    if (!title.trim() || !slug.trim()) {
      toast.error("Titel und slug erforderlich");
      return;
    }
    if (type === "page" && !pageUrl.trim()) {
      toast.error("Ziel-URL erforderlich");
      return;
    }
    if (type === "document" && !file && !editing) {
      toast.error("Bitte Datei hochladen");
      return;
    }
    if (tenantId === "platform") {
      toast.error("Bitte zuerst einen Workspace öffnen (nicht die Platform-Ansicht).");
      return;
    }
    setBusy(true);
    setProgress(type === "document" ? 0 : null);
    try {
      let uploadId: string | undefined;
      if (type === "document" && file) {
        const uploaded = await uploadFile(file.raw);
        uploadId = uploaded;
      }
      const payload = type === "document" ? withChatMode(chatMode, actionsPayload(actions, initial?.payload)) : initial?.payload;
      const s = editing
        ? await updateResource({
            data: {
              id: initial!.id,
              title: title.trim(),
              slug: slug.trim().replace(/^\//, ""),
              description: description.trim(),
              tags,
              payload,
              tenant_id: tenantId,
            },
          })
        : await createResource({
            data: {
              type,
              title: title.trim(),
              slug: slug.trim().replace(/^\//, ""),
              description: description.trim(),
              content_url: type === "page" ? pageUrl.trim() : undefined,
              upload_id: uploadId,
              mime_type: type === "document" ? file!.mime : undefined,
              file_name: type === "document" ? file!.name : undefined,
              file_size: type === "document" ? file!.size : undefined,
              tags,
              payload,
              tenant_id: tenantId,
            },
          });
      onCreated(s as FullState);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <FullScreenModal
      title={editing ? t("common.edit") : "Inhalt hinzufügen"}
      description={editing ? initial?.title : "Dokument hochladen oder interne Seite hinter einer geschützten URL."}
      onClose={onCancel}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? t("common.loading") : editing ? t("common.save") : "Anlegen"}
          </Button>
        </>
      }
    >
      {!editing && (
      <div className="flex gap-2">
        {(
          [
            ["document", "Dokument"],
            ["page", "Webseite"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            className={
              type === v
                ? "min-h-11 flex-1 rounded-lg bg-primary/15 px-3 py-2 text-sm font-medium text-primary"
                : "min-h-11 flex-1 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted"
            }
          >
            {label}
          </button>
        ))}
      </div>
      )}
      <div>
        <Label>Titel</Label>
        <Input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Verkaufsfolder Markisen"
          required
        />
      </div>
      <div>
        <Label>Slug / Pfad</Label>
        <Input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="folder-markisen.pdf"
          className="font-mono text-sm"
          required
        />
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Label>Tags</Label>
        <TagPicker
          catalog={catalog}
          value={tags}
          onChange={setTags}
          onCreate={async (name, color) => {
            await createTag({ data: { name, color, tenant_id: tenantId } });
          }}
        />
      </div>
      {type === "document" ? (
        <div>
          {!editing && (
            <>
          <Label>Datei hochladen</Label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-elevated px-4 py-10 text-center hover:border-border-strong">
            <Upload className="h-6 w-6 text-fg-subtle" />
            <span className="text-sm text-fg-muted">
              {file
                ? `${file.name} · ${formatBytes(file.size)}`
                : `PDF, Bilder oder Office (max. ${MAX_UPLOAD_LABEL})`}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,application/pdf,image/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {progress != null && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-fg-subtle">Upload {progress}%</p>
            </div>
          )}
            </>
          )}
          <div className="mt-4">
            <Label>{t("doc.actions")}</Label>
            <DocActionPicker value={actions} onChange={setActions} />
          </div>
          <div className="mt-3">
            <Label>{t("doc.chatMode")}</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
              value={chatMode}
              onChange={(e) => setChatMode(e.target.value as ChatMode)}
            >
              <option value="off">{t("doc.chatOff")}</option>
              <option value="shared">{t("doc.chatShared")}</option>
              <option value="per_email">{t("doc.chatPerEmail")}</option>
            </select>
          </div>
        </div>
      ) : (
        <div>
          <Label>Ziel-URL (iframe)</Label>
          <Input
            type="url"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="https://www.muster-gmbh.de/intern/samila-fenster/"
            required
          />
          <p className="mt-1 text-xs text-fg-subtle">
            Die öffentliche URL bleibt auf deiner Domain; die Zielseite läuft im
            Frame.
          </p>
        </div>
      )}
    </FullScreenModal>
  );
}
