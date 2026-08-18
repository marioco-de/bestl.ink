import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronDown,
  Clock,
  ImageIcon,
  KeyRound,
  Megaphone,
  MonitorSmartphone,
  Shuffle,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { useControl } from "@/lib/docbay/control-store";
import { CreateKindBar } from "./create-kind-bar";
import type { CreateKind } from "@/lib/docbay/create-kind";
import { createShort } from "@/lib/docbay/shorts-api";
import { genToken } from "@/lib/docbay/id";
import { PLATFORM_LINK_HOST } from "@/lib/docbay/brand";
import { orderedHosts, defaultHost, withHttp } from "@/lib/docbay/hosts";
import { cn, slugify } from "@/lib/utils";
import type { FullState } from "@/lib/docbay/types";
import { LinkEditorShell, DashPinBlock } from "./link-editor-shell";
import { TagPicker } from "./tag-picker";
import { createTag, createResource, generateLink, createParamNode, uploadBegin, uploadChunk } from "@/lib/docbay/api";
import { pinShortDash } from "@/lib/docbay/dashboard-api";
import { upsertShort } from "@/lib/docbay/state-patch";
import { useT } from "@/lib/i18n";
import { Toggle } from "@/components/ui/toggle";
import { EventFields, ContactFields } from "@/routes/control/-cards";
import { emptyContact, emptyEvent } from "@/lib/docbay/cards";
import { suggestCardSlug, cardKindPath } from "@/lib/docbay/public-url";
import { DocActionPicker } from "./doc-action-picker";
import { actionsPayload, withChatMode, withRequireRequest, type ChatMode, type DocAction } from "@/lib/docbay/doc-actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/docbay/upload";
import { Upload } from "lucide-react";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";

type Extra = "tags" | "campaign" | "device" | "lock" | "ttl" | null;

function slugFromPageUrl(raw: string) {
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(href);
    const last = u.pathname.split("/").filter(Boolean).pop() || u.hostname.split(".")[0] || "";
    const clean = slugify(last.replace(/\.[a-z0-9]{1,8}$/i, "")).slice(0, 40);
    return clean || "";
  } catch {
    return "";
  }
}

export function CreateLinkModal() {
  const { data, setData, createOpen, createSeed, createKind, setCreateKind, closeCreate } =
    useControl();
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  if (!createOpen) return null;
  if (doneUrl) {
    return (
      <FullScreenModal title="Link bereit" onClose={closeCreate} wide>
        <div className="flex flex-col items-stretch gap-4 py-4 @min-[640px]/fs:flex-row @min-[640px]/fs:items-center">
          <p className="min-w-0 flex-1 break-all font-mono text-sm">{doneUrl}</p>
          <Button
            className="shrink-0"
            onClick={() => {
              void navigator.clipboard.writeText(doneUrl);
              toast.success("Kopiert");
            }}
          >
            Kopieren
          </Button>
        </div>
      </FullScreenModal>
    );
  }
  return (
    <Editor
      key={`${createKind}-${createSeed}`}
      data={data}
      seed={createSeed}
      kind={createKind}
      onKind={setCreateKind}
      onClose={closeCreate}
      onSaved={(s, url) => {
        setData(s);
        if (url) setDoneUrl(url);
        else closeCreate();
      }}
    />
  );
}

function Editor({
  data,
  seed,
  kind,
  onKind,
  onClose,
  onSaved,
}: {
  data: FullState;
  seed: string;
  kind: CreateKind;
  onKind: (k: CreateKind) => void;
  onClose: () => void;
  onSaved: (s: FullState, url?: string) => void;
}) {
  const { setData, switchWorkspace, prefetchWorkspace } = useControl();
  const t = useT();
  const navigate = useNavigate();
  const hosts = useMemo(() => orderedHosts(data), [data]);
  const [host, setHost] = useState(defaultHost(data));
  const [destination, setDestination] = useState(seed);
  const [slug, setSlug] = useState(() => genToken(5));
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [expiresHours, setExpiresHours] = useState("");
  const [ios, setIos] = useState("");
  const [android, setAndroid] = useState("");
  const [utmS, setUtmS] = useState("");
  const [utmM, setUtmM] = useState("");
  const [utmC, setUtmC] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareText, setShareText] = useState("");
  const [shareImage, setShareImage] = useState("");
  const [extra, setExtra] = useState<Extra>(null);
  const [busy, setBusy] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [pinDash, setPinDash] = useState(false);
  const [dashDisplay, setDashDisplay] = useState<"text" | "icon" | "preview">("text");
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docActions, setDocActions] = useState<DocAction[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>("shared");
  const [requireRequest, setRequireRequest] = useState(kind === "document");
  const [event, setEvent] = useState(emptyEvent);
  const [contact, setContact] = useState(emptyContact);
  const [progress, setProgress] = useState<number | null>(null);

  const workspaces = data.workspaces.length
    ? data.workspaces
    : [
        {
          id: data.tenant.id,
          name: data.tenant.name,
          subdomain: data.tenant.subdomain,
          role: data.member.role,
        },
      ];

  useEffect(() => {
    if (!hosts.includes(host)) {
      setHost(hosts[0] || data.tenant.public_host || PLATFORM_LINK_HOST);
    }
  }, [hosts, data.tenant.public_host, host]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (hostOpen || wsOpen || extra) {
          setHostOpen(false);
          setWsOpen(false);
          setExtra(null);
          return;
        }
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, hostOpen, wsOpen, extra]);

  function pickWorkspace(id: string) {
    if (id === data.tenant.id) {
      setWsOpen(false);
      return;
    }
    switchWorkspace(id);
    setTags([]);
    setWsOpen(false);
    void navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, tenant: id }),
    } as never);
  }

  useEffect(() => {
    if (kind !== "page") return;
    const next = slugFromPageUrl(destination);
    if (next) setSlug(next);
  }, [destination, kind]);

  useEffect(() => {
    if (kind === "event") setSlug(suggestCardSlug("event", event.start));
    if (kind === "contact") setSlug(suggestCardSlug("contact"));
    setRequireRequest(kind === "document");
  }, [kind]);

  async function ensureButton(state: FullState) {
    let buttonId = state.params.find((p) => p.kind === "button")?.id;
    if (buttonId) return { state, buttonId };
    state = (await createParamNode({
      data: { name: "Direkt", kind: "button" },
    })) as FullState;
    buttonId = state.params.find((p) => p.kind === "button")?.id;
    if (!buttonId) throw new Error("Kein Button");
    return { state, buttonId };
  }

  async function uploadFile(f: File): Promise<string> {
    const started = await uploadBegin({
      data: {
        file_name: f.name,
        mime_type: f.type || "application/octet-stream",
        file_size: f.size,
        tenant_id: data.tenant.id,
      },
    });
    const buf = new Uint8Array(await f.arrayBuffer());
    const chunk = 512 * 1024;
    const toB64 = (bytes: Uint8Array) => {
      const step = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
      }
      return btoa(binary);
    };
    for (let offset = 0; offset < buf.length; offset += chunk) {
      const slice = buf.subarray(offset, Math.min(offset + chunk, buf.length));
      await uploadChunk({
        data: { upload_id: started.upload_id, data: toB64(slice), tenant_id: data.tenant.id },
      });
      setProgress(Math.min(99, Math.round(((offset + slice.length) / buf.length) * 100)));
    }
    setProgress(100);
    return started.upload_id;
  }

  async function pinIfNeeded(state: FullState, publicUrl: string, label: string) {
    if (!pinDash) return state;
    try {
      const created = await createShort({
        data: {
          destination: publicUrl,
          title: label,
          tenant_id: data.tenant.id,
        },
      });
      let next = upsertShort(state, created.short);
      const dash = await pinShortDash({
        data: {
          tenant_id: data.tenant.id,
          short_id: created.short.id,
          label,
          display: dashDisplay,
          image: shareImage || null,
        },
      });
      return { ...next, dash };
    } catch {
      return state;
    }
  }

  async function save() {
    setBusy(true);
    try {
      if (kind === "document") {
        if (!docFile) {
          toast.error("Bitte Datei hochladen");
          return;
        }
        if (docFile.size > MAX_UPLOAD_BYTES) {
          toast.error(`Max. ${MAX_UPLOAD_LABEL}`);
          return;
        }
        const title = docTitle.trim() || docFile.name.replace(/\.[^.]+$/, "");
        const pageSlug = (slug || slugify(title) || genToken(5)).replace(/^\//, "");
        const uploadId = await uploadFile(docFile);
        const payload = withRequireRequest(
          requireRequest,
          withChatMode(chatMode, actionsPayload(docActions)),
        );
        let state = (await createResource({
          data: {
            type: "document",
            title,
            slug: pageSlug,
            upload_id: uploadId,
            mime_type: docFile.type,
            file_name: docFile.name,
            file_size: docFile.size,
            tags,
            payload,
            tenant_id: data.tenant.id,
          },
        })) as FullState;
        const resource = state.resources.find((r) => r.slug === pageSlug);
        if (!resource) throw new Error("Dokument nicht angelegt");
        const ready = await ensureButton(state);
        state = ready.state;
        const made = await generateLink({
          data: {
            resource_id: resource.id,
            button_id: ready.buttonId,
            note: note.trim(),
            tags,
          },
        });
        if (made.state) state = made.state as FullState;
        const url = `https://${host}/${pageSlug}${requireRequest ? `?access=${made.token}` : ""}`;
        state = await pinIfNeeded(state, url, title);
        toast.success(t("short.ready", { path: `${host}/${pageSlug}` }));
        onSaved(state, url);
        return;
      }

      if (kind === "event" || kind === "contact") {
        const name = (kind === "event" ? event.title : contact.name).trim();
        if (!name) {
          toast.error(kind === "event" ? "Titel fehlt" : "Name fehlt");
          return;
        }
        const pageSlug = (
          slug || suggestCardSlug(kind, kind === "event" ? event.start : undefined)
        ).replace(/^\//, "");
        const payload = kind === "event" ? { ...event, title: name } : { ...contact, name };
        let state = (await createResource({
          data: {
            type: kind,
            title: name,
            slug: pageSlug,
            description: kind === "event" ? event.location || "" : contact.company || "",
            payload,
            mime_type: kind === "event" ? "text/calendar" : "text/vcard",
            allow_download: true,
            tags,
            tenant_id: data.tenant.id,
          },
        })) as FullState;
        const resource = state.resources.find((r) => r.slug === pageSlug);
        if (!resource) throw new Error("Nicht angelegt");
        const ready = await ensureButton(state);
        state = ready.state;
        const made = await generateLink({
          data: { resource_id: resource.id, button_id: ready.buttonId, note: note.trim(), tags },
        });
        if (made.state) state = made.state as FullState;
        const prefix = cardKindPath(kind);
        const url = `https://${host}/${prefix}/${pageSlug}`;
        state = await pinIfNeeded(state, url, name);
        toast.success(t("short.ready", { path: `${host}/${prefix}/${pageSlug}` }));
        onSaved(state, url);
        return;
      }

      const dest = withHttp(destination);
      if (!dest) {
        toast.error(t("short.destMissing"));
        return;
      }
      const withProto = /^https?:\/\//i.test(dest) ? dest : `https://${dest}`;
      if (kind === "page") {
        const pageSlug = (slug || slugFromPageUrl(withProto) || genToken(5))
          .replace(/^\//, "")
          .replace(/\/$/, "");
        const title = shareTitle.trim() || note.trim() || pageSlug;
        let state = data;
        let buttonId = state.params.find((p) => p.kind === "button")?.id;
        if (!buttonId) {
          state = (await createParamNode({
            data: { name: "Direkt", kind: "button" },
          })) as FullState;
          buttonId = state.params.find((p) => p.kind === "button")?.id;
        }
        if (!buttonId) throw new Error("Kein Button");
        state = (await createResource({
          data: {
            type: "page",
            title,
            slug: pageSlug,
            content_url: withProto,
            tags,
            payload: { require_request: false },
            tenant_id: data.tenant.id,
          },
        })) as FullState;
        const resource = state.resources.find((r) => r.slug === pageSlug);
        if (!resource) throw new Error("Seite nicht angelegt");
        const made = await generateLink({
          data: {
            resource_id: resource.id,
            button_id: buttonId,
            note: note.trim(),
            tags,
            expires_hours: expiresHours ? Number(expiresHours) : null,
            password: password || undefined,
          },
        });
        if (made.state) state = made.state as FullState;
        toast.success(t("short.ready", { path: `${host}/${pageSlug}?access=${made.token}` }));
        onSaved(state, `https://${host}/${pageSlug}?access=${made.token}`);
        return;
      }
      const created = await createShort({
        data: {
          destination: withProto,
          slug: slug || undefined,
          title: shareTitle || undefined,
          note,
          tags,
          password: password || undefined,
          expires_hours: expiresHours ? Number(expiresHours) : null,
          ios_url: ios || undefined,
          android_url: android || undefined,
          og_title: shareTitle || undefined,
          og_description: shareText || undefined,
          og_image: shareImage || undefined,
          utm_source: utmS || undefined,
          utm_medium: utmM || undefined,
          utm_campaign: utmC || undefined,
          tenant_id: data.tenant.id,
        },
      });
      toast.success(t("short.ready", { path: `${host}/${created.short.slug}` }));
      let next = upsertShort(data, created.short);
      if (pinDash) {
        const dash = await pinShortDash({
          data: {
            tenant_id: data.tenant.id,
            short_id: created.short.id,
            label: note || shareTitle || created.short.slug,
            display: dashDisplay,
            image: shareImage || null,
          },
        });
        next = { ...next, dash };
      }
      onSaved(next, `https://${host}/${created.short.slug}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const extras: { id: Extra; label: string; icon: typeof Clock; on: boolean }[] = [
    { id: "tags", label: t("short.tags"), icon: Tag, on: tags.length > 0 },
    { id: "campaign", label: t("short.campaign"), icon: Megaphone, on: Boolean(utmS || utmM || utmC) },
    { id: "device", label: t("short.device"), icon: MonitorSmartphone, on: Boolean(ios || android) },
    { id: "lock", label: t("short.lock"), icon: KeyRound, on: Boolean(password) },
    { id: "ttl", label: t("short.ttl"), icon: Clock, on: Boolean(expiresHours) },
  ];

  const shortUrl =
    kind === "event"
      ? `https://${host}/ics/${slug || "termin"}`
      : kind === "contact"
        ? `https://${host}/vcf/${slug || "kontakt"}`
        : `https://${host}/${slug || "link"}`;
  const previewTitle = shareTitle || docTitle || event.title || contact.name || destination || slug;
  const previewText = shareText || note || event.description || contact.company || "";
  const kindTitle =
    kind === "document"
      ? t("create.doc")
      : kind === "page"
        ? t("create.page")
        : kind === "event"
          ? t("create.event")
          : kind === "contact"
            ? t("create.contact")
            : t("create.url");

  return (
    <>
    <LinkEditorShell
      title={kindTitle}
      description={kind === "page" ? t("create.pageHint") : t("short.createHint")}
      onClose={onClose}
      toolbar={<CreateKindBar value={kind} onChange={onKind} />}
      url={shortUrl}
      slug={slug}
      preview={{ title: previewTitle, text: previewText, image: shareImage, host }}
      footer={
        <>
          <div className="flex flex-wrap gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setWsOpen((v) => !v);
                  setHostOpen(false);
                }}
                className={cn(
                  "inline-flex h-8 max-w-[11rem] items-center gap-1 rounded-md border px-2 text-[11px] transition-colors",
                  wsOpen
                    ? "border-fg bg-fg text-bg"
                    : "border-border text-fg-muted hover:bg-bg-subtle hover:text-fg",
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{data.tenant.name}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
              </button>
              {wsOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-10" onClick={() => setWsOpen(false)} />
                  <ul className="absolute bottom-full left-0 z-20 mb-1 min-w-[14rem] overflow-hidden rounded-md border border-border bg-bg-elevated py-1 shadow-lg">
                    {workspaces.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg-subtle"
                          onMouseEnter={() => prefetchWorkspace(w.id)}
                          onClick={() => pickWorkspace(w.id)}
                        >
                          <span className="min-w-0 flex-1 truncate">{w.name}</span>
                          {w.id === data.tenant.id && <Check className="h-3 w-3 shrink-0 text-primary" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {extras.map((c) => {
              const Icon = c.icon;
              const active = extra === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setExtra(active ? null : c.id)}
                  className={cn(
                    "group relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                    active || c.on
                      ? "border-fg bg-fg text-bg"
                      : "border-border text-fg-muted hover:bg-bg-subtle hover:text-fg",
                  )}
                  title={c.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
          <Button className="h-9" disabled={busy} onClick={() => void save()}>
            {busy ? t("common.loading") : t("short.createBtn")}
          </Button>
        </>
      }
    >
      {(kind === "url" || kind === "page") && (
        <section>
          <p className="mb-1.5 text-xs font-medium">{t("short.destLabel")}</p>
          <Input
            autoFocus
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t("short.destPlaceholder")}
          />
        </section>
      )}

      {kind === "document" && (
        <section className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium">Datei</p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg px-4 py-8 text-center hover:border-border-strong">
              <Upload className="h-6 w-6 text-fg-subtle" />
              <span className="text-sm text-fg-muted">
                {docFile ? docFile.name : `PDF, Bilder oder Office (max. ${MAX_UPLOAD_LABEL})`}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,application/pdf,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setDocFile(f);
                  if (f && !docTitle) setDocTitle(f.name.replace(/\.[^.]+$/, ""));
                  if (f) setSlug(f.name.toLowerCase().replace(/\s+/g, "-"));
                }}
              />
            </label>
            {progress != null && (
              <p className="mt-1 text-xs text-fg-subtle">Upload {progress}%</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium">Titel</p>
            <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
          </div>
          <DocActionPicker value={docActions} onChange={setDocActions} />
          <div>
            <p className="mb-1.5 text-xs font-medium">{t("doc.chatMode")}</p>
            <select
              className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
              value={chatMode}
              onChange={(e) => setChatMode(e.target.value as ChatMode)}
            >
              <option value="off">{t("doc.chatOff")}</option>
              <option value="shared">{t("doc.chatShared")}</option>
              <option value="per_email">{t("doc.chatPerEmail")}</option>
            </select>
          </div>
          <Toggle
            label="Zugriff muss angefragt werden"
            checked={requireRequest}
            onChange={setRequireRequest}
          />
        </section>
      )}

      {kind === "event" && (
        <EventFields
          event={event}
          setEvent={(next) => {
            setEvent(next);
            setSlug(suggestCardSlug("event", next.start));
          }}
        />
      )}
      {kind === "contact" && (
        <ContactFields
          contact={contact}
          setContact={(next) => {
            setContact(next);
            if (next.name) setSlug(suggestCardSlug("contact"));
          }}
        />
      )}

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium">{t("short.nameLabel")}</p>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 text-[11px] text-fg-muted hover:text-fg"
            onClick={() =>
              setSlug(
                kind === "event"
                  ? suggestCardSlug("event", event.start)
                  : kind === "contact"
                    ? suggestCardSlug("contact")
                    : genToken(5),
              )
            }
          >
            <Shuffle className="h-3 w-3" /> {t("short.roll")}
          </button>
        </div>
        <div className="flex rounded-md border border-border bg-bg">
          <div className="relative max-w-[58%] shrink-0 border-r border-border">
            <button
              type="button"
              onClick={() => {
                setHostOpen((v) => !v);
                setWsOpen(false);
              }}
              className="flex h-full min-h-9 w-full items-center gap-1 bg-bg-subtle px-2.5 text-left text-[11px] text-fg-muted hover:text-fg"
            >
              <span className="min-w-0 truncate">
                {host}/{kind === "event" ? "ics/" : kind === "contact" ? "vcf/" : ""}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
            </button>
            {hostOpen && (
              <>
                <button type="button" className="fixed inset-0 z-10" onClick={() => setHostOpen(false)} />
                <ul className="absolute left-0 top-full z-20 mt-1 min-w-[14rem] overflow-hidden rounded-md border border-border bg-bg-elevated py-1 shadow-lg">
                  {hosts.map((h) => (
                    <li key={h}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg-subtle"
                        onClick={() => {
                          setHost(h);
                          setHostOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">{h}</span>
                        {h === host && <Check className="h-3 w-3 shrink-0 text-primary" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <input
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-sm outline-none"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
          />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-medium text-fg-muted">{t("short.teamOnly")}</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("short.notePh")}
          className="min-h-[64px]"
        />
      </section>

      <section>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">{t("short.shareWhen")}</p>
        <div className="overflow-hidden rounded-md border border-border bg-bg">
          <div className="flex aspect-[2/1] items-center justify-center bg-bg-subtle">
            {shareImage ? (
              <img src={shareImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-fg-subtle" />
            )}
          </div>
          <div className="space-y-1 p-2.5">
            <input
              className="w-full bg-transparent text-sm font-medium outline-none"
              placeholder={t("short.shareTitlePh")}
              value={shareTitle}
              onChange={(e) => setShareTitle(e.target.value)}
            />
            <input
              className="w-full bg-transparent text-xs text-fg-muted outline-none"
              placeholder={t("short.shareTextPh")}
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
            />
            <input
              className="w-full bg-transparent text-[11px] text-fg-subtle outline-none"
              placeholder={t("short.shareImgPh")}
              value={shareImage}
              onChange={(e) => setShareImage(e.target.value)}
            />
          </div>
        </div>
      </section>

      {extra && (
        <div className="space-y-3 rounded-md border border-border bg-bg p-3">
          {extra === "campaign" && (
            <div className="grid gap-2 @min-[28rem]/modal:grid-cols-3">
              <Mini label={t("short.utmSource")} value={utmS} onChange={setUtmS} />
              <Mini label={t("short.utmMedium")} value={utmM} onChange={setUtmM} />
              <Mini label={t("short.utmName")} value={utmC} onChange={setUtmC} />
            </div>
          )}
          {extra === "device" && (
            <div className="grid gap-2">
              <Mini label={t("short.iosUrl")} value={ios} onChange={setIos} />
              <Mini label={t("short.androidUrl")} value={android} onChange={setAndroid} />
            </div>
          )}
          {extra === "lock" && (
            <Mini label={t("short.openPassword")} value={password} onChange={setPassword} />
          )}
          {extra === "ttl" && (
            <Mini label={t("short.hoursUntil")} value={expiresHours} onChange={setExpiresHours} type="number" />
          )}
        </div>
      )}

      <DashPinBlock pin={pinDash} onPin={setPinDash} display={dashDisplay} onDisplay={setDashDisplay} />
    </LinkEditorShell>
    {extra && (
      <ExtraModal title={extras.find((e) => e.id === extra)?.label || ""} onClose={() => setExtra(null)}>
        {extra === "tags" && (
          <TagPicker
            catalog={data.tags}
            value={tags}
            onChange={setTags}
            onCreate={async (name, color) => {
              const next = (await createTag({
                data: { name, color, tenant_id: data.tenant.id },
              })) as FullState;
              setData(next);
            }}
          />
        )}
        {extra === "campaign" && (
          <div className="grid gap-2">
            <Mini label={t("short.utmSource")} value={utmS} onChange={setUtmS} />
            <Mini label={t("short.utmMedium")} value={utmM} onChange={setUtmM} />
            <Mini label={t("short.utmName")} value={utmC} onChange={setUtmC} />
          </div>
        )}
        {extra === "device" && (
          <div className="grid gap-2">
            <Mini label={t("short.iosUrl")} value={ios} onChange={setIos} />
            <Mini label={t("short.androidUrl")} value={android} onChange={setAndroid} />
          </div>
        )}
        {extra === "lock" && (
          <Mini label={t("short.openPassword")} value={password} onChange={setPassword} />
        )}
        {extra === "ttl" && (
          <Mini label={t("short.hoursUntil")} value={expiresHours} onChange={setExpiresHours} type="number" />
        )}
      </ExtraModal>
    )}
    </>
  );
}

function ExtraModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-fg/25" aria-label="Schließen" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        <div className="mt-4 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>
            Fertig
          </Button>
        </div>
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
