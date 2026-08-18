import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
import { LinkEditorShell, DashPinBlock } from "@/components/control/link-editor-shell";
import { defaultHost } from "@/lib/docbay/hosts";
import { GeneratePanel } from "@/components/hashport/generate-panel";
import { useControlData, useSetControlData, useOpenCreate } from "@/lib/docbay/use-control";
import { createResource, deleteResource, updateResource, uploadBegin, uploadChunk, createTag } from "@/lib/docbay/api";
import { formatBytes, slugify, cn, formatDateDe } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/docbay/upload";
import type { FullState, GeneratedLink, Resource } from "@/lib/docbay/types";
import { TagChip, TagPicker } from "@/components/control/tag-picker";
import { tagColor } from "@/lib/docbay/tags";
import { DocActionPicker } from "@/components/control/doc-action-picker";
import { actionsPayload, parseChatMode, parseDocActions, parseRequireRequest, withChatMode, withRequireRequest, type ChatMode, type DocAction } from "@/lib/docbay/doc-actions";
import { RequestAccessToggle } from "@/components/ui/toggle";
import { useT } from "@/lib/i18n";
import { PresenceEye } from "@/components/control/presence-eye";
import { RowMenu, VisitMeta } from "@/components/control/row-menu";

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
  const openCreate = useOpenCreate();
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
            onClick={() => openCreate("", typeFilter === "page" ? "page" : "document")}
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

      <div className="overflow-visible rounded-lg border border-border">
        {items.map((r, i) => (
          <ResourceRow
            key={r.id}
            r={r}
            i={i}
            tags={state.tags}
            links={state.links}
            host={state.tenant.public_host}
            onEdit={() => setFormFor(r)}
            onGenerate={() => setGenerateFor(r)}
            onDelete={async () => {
              if (!confirm("Inhalt wirklich löschen?")) return;
              const s = await deleteResource({ data: { id: r.id } });
              await refresh(s as FullState);
              toast.success("Gelöscht");
            }}
          />
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

function ResourceRow({
  r,
  i,
  tags,
  links,
  host,
  onEdit,
  onGenerate,
  onDelete,
}: {
  r: Resource;
  i: number;
  tags: FullState["tags"];
  links: GeneratedLink[];
  host: string;
  onEdit: () => void;
  onGenerate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const mine = links.filter((l) => l.resource_id === r.id && !l.revoked);
  const clicks = mine.reduce((a, l) => a + l.human_click_count, 0);
  let last: string | null = null;
  let presence = null as (typeof mine)[number]["presence"];
  for (const l of mine) {
    if (l.last_clicked_at && (!last || l.last_clicked_at > last)) last = l.last_clicked_at;
    if (l.presence && (!presence || l.presence.at > presence.at)) presence = l.presence;
  }
  return (
    <div className={cn("px-3 py-2.5", i > 0 && "border-t border-border")}>
      <div
        className="flex cursor-pointer flex-col gap-2 @min-[40rem]/hub:flex-row @min-[40rem]/hub:items-center @min-[40rem]/hub:justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PresenceEye presence={presence} />
            {r.type === "document" ? (
              <FileText className="h-3.5 w-3.5 text-fg-muted" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-fg-muted" />
            )}
            <p className="truncate text-sm font-medium">{r.title}</p>
            <Badge variant="secondary">
              {r.type === "document" ? "Dokument" : "Webseite"}
            </Badge>
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">
            /{r.slug}
            {r.type === "page" ? "/" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <VisitMeta
            clicks={clicks}
            at={last ? formatDateDe(last) : null}
            lastLabel={t("links.lastVisit")}
          />
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" onClick={onGenerate}>
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <RowMenu
              items={[
                { label: t("links.edit"), icon: Pencil, onClick: onEdit },
                {
                  label: t("links.delete"),
                  icon: Trash2,
                  danger: true,
                  onClick: () => void onDelete(),
                },
              ]}
            />
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 border-t border-border/70 pt-2 text-xs text-fg-muted">
          {r.description && <p>{r.description}</p>}
          {(r.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.tags.map((n) => (
                <TagChip key={n} name={n} color={tagColor(n, tags)} on />
              ))}
            </div>
          )}
          {r.type === "document" && (
            <p>{r.file_name || "Datei"} · {formatBytes(r.file_size)}</p>
          )}
          {r.type === "page" && r.content_url && <p>→ {r.content_url}</p>}
          {mine.length > 0 && (
            <ul className="space-y-1.5">
              {mine.map((l) => {
                const url = `https://${host}/${r.slug}${r.type === "page" ? "/" : ""}?access=${l.token}`;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 rounded-md bg-bg-subtle/70 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] text-fg">{url}</p>
                      <p className="text-[10px] text-fg-subtle">
                        {l.button_name || "Link"}
                        {l.note ? ` · ${l.note}` : ""}
                        {` · ${l.human_click_count}`}
                        {l.last_clicked_at ? ` · ${t("links.lastVisit")} ${formatDateDe(l.last_clicked_at)}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-[11px] text-primary"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        toast.success("Kopiert");
                      }}
                    >
                      Kopieren
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {mine.length === 0 && (
            <p>{t("links.none")}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ResourceForm({
  tenantId,
  defaultType = "document",
  initial,
  onCancel,
  onCreated,
  toolbar,
}: {
  tenantId: string;
  defaultType?: "document" | "page";
  initial?: Resource;
  onCancel: () => void;
  onCreated: (s: FullState) => void;
  toolbar?: ReactNode;
}) {
  const catalog = useControlData().tags;
  const data = useControlData();
  const host = defaultHost(data);
  const [pinDash, setPinDash] = useState(false);
  const [dashDisplay, setDashDisplay] = useState<"text" | "icon" | "preview">("text");
  const t = useT();
  const editing = Boolean(initial);
  const [type, setType] = useState<"document" | "page">(initial?.type === "page" ? "page" : defaultType);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [descOpen, setDescOpen] = useState(Boolean(initial?.description));
  const [pageUrl, setPageUrl] = useState(initial?.content_url ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [actions, setActions] = useState<DocAction[]>(() => parseDocActions(initial?.payload));
  const [chatMode, setChatMode] = useState<ChatMode>(() => parseChatMode(initial?.payload));
  const [requireRequest, setRequireRequest] = useState(() =>
    parseRequireRequest(initial?.payload, initial?.type || defaultType),
  );
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
      const payload = withRequireRequest(
        requireRequest,
        type === "document" ? withChatMode(chatMode, actionsPayload(actions, initial?.payload)) : initial?.payload,
      );
      const s = editing
        ? await updateResource({
            data: {
              id: initial!.id,
              title: title.trim(),
              slug: slug.trim().replace(/^\//, ""),
              description: description.trim(),
              tags,
              payload,
              content_url: type === "page" ? pageUrl.trim() : undefined,
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
    <LinkEditorShell
      title={editing ? t("common.edit") : "Inhalt hinzufügen"}
      description={editing ? initial?.title : "Dokument hochladen oder interne Seite hinter einer geschützten URL."}
      onClose={onCancel}
      toolbar={toolbar}
      url={`https://${host}/${slug || "link"}`}
      slug={slug}
      preview={{ title, text: description, image: "", host }}
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
      {!editing && !toolbar && (
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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Titel</Label>
          {!descOpen && (
            <button
              type="button"
              onClick={() => setDescOpen(true)}
              className="inline-flex h-7 items-center gap-1 text-[11px] text-fg-muted hover:text-fg"
            >
              <Plus className="h-3 w-3" />
              {t("short.addDescription")}
            </button>
          )}
        </div>
        <Input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Verkaufsfolder Markisen"
          required
        />
        {descOpen && (
          <div>
            <Label>{t("short.publicDesc")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("short.publicDescPh")}
            />
          </div>
        )}
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
          <div className="mt-3">
            <RequestAccessToggle
              hint="Aus: die Seite ist über den Slug ohne Token erreichbar."
              checked={requireRequest}
              onChange={setRequireRequest}
            />
          </div>
        </div>
      )}
      <DashPinBlock pin={pinDash} onPin={setPinDash} display={dashDisplay} onDisplay={setDashDisplay} />
    </LinkEditorShell>
  );
}
