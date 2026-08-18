import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronDown,
  Clock,
  ImageIcon,
  KeyRound,
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
import { ResourceForm } from "@/routes/control/resources";
import { CardForm } from "@/routes/control/-cards";
import type { CreateKind } from "@/lib/docbay/create-kind";
import { createShort } from "@/lib/docbay/shorts-api";
import { genToken } from "@/lib/docbay/id";
import { PLATFORM_LINK_HOST } from "@/lib/docbay/brand";
import { orderedHosts, defaultHost, withHttp } from "@/lib/docbay/hosts";
import { cn } from "@/lib/utils";
import type { FullState } from "@/lib/docbay/types";
import { QrDrawer } from "./qr-drawer";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { TagPicker } from "./tag-picker";
import { createTag, createResource, generateLink, createParamNode } from "@/lib/docbay/api";
import { slugify } from "@/lib/utils";
import { pinShortDash } from "@/lib/docbay/dashboard-api";
import { upsertShort } from "@/lib/docbay/state-patch";
import { useT } from "@/lib/i18n";
import { Toggle } from "@/components/ui/toggle";

type Extra = "campaign" | "device" | "lock" | "ttl" | null;

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
  if (createKind === "document") {
    return (
      <ResourceForm
        tenantId={data.tenant.id}
        defaultType={createKind}
        toolbar={<CreateKindBar value={createKind} onChange={setCreateKind} />}
        onCancel={closeCreate}
        onCreated={(s) => {
          setData(s);
          closeCreate();
        }}
      />
    );
  }
  if (createKind === "event" || createKind === "contact") {
    return (
      <CardForm
        kind={createKind}
        tenantId={data.tenant.id}
        existing={null}
        toolbar={<CreateKindBar value={createKind} onChange={setCreateKind} />}
        onClose={closeCreate}
        onSaved={(s) => {
          setData(s);
          closeCreate();
        }}
      />
    );
  }
  return (
    <Editor
      key={createSeed}
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
        if (hostOpen || wsOpen) {
          setHostOpen(false);
          setWsOpen(false);
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
  }, [onClose, hostOpen, wsOpen]);

  const shortUrl = `https://${host}/${slug || "link"}`;

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

  async function save() {
    const dest = withHttp(destination);
    if (!dest) {
      toast.error(t("short.destMissing"));
      return;
    }
    const withProto = /^https?:\/\//i.test(dest) ? dest : `https://${dest}`;
    setBusy(true);
    try {
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
    { id: "campaign", label: t("short.campaign"), icon: Tag, on: Boolean(utmS || utmM || utmC) },
    { id: "device", label: t("short.device"), icon: MonitorSmartphone, on: Boolean(ios || android) },
    { id: "lock", label: t("short.lock"), icon: KeyRound, on: Boolean(password) },
    { id: "ttl", label: t("short.ttl"), icon: Clock, on: Boolean(expiresHours) },
  ];

  return (
    <div className="@container/stage fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div className="relative flex h-full w-full items-center justify-center p-0 @min-[40rem]/stage:p-6 @min-[40rem]/stage:pr-14">
        <div className="relative flex h-full w-full max-w-none @min-[40rem]/stage:h-auto @min-[40rem]/stage:max-h-[min(88dvh,720px)] @min-[40rem]/stage:max-w-[34rem]">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("short.createTitle")}
          className="@container/modal relative z-20 flex h-full min-w-0 w-full flex-col overflow-hidden bg-bg-elevated shadow-2xl @min-[40rem]/stage:h-auto @min-[40rem]/stage:max-h-[min(88dvh,720px)] @min-[40rem]/stage:rounded-xl @min-[40rem]/stage:border @min-[40rem]/stage:border-border"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                {kind === "page" ? t("create.page") : t("short.createTitle")}
              </h2>
              <p className="text-[12px] text-fg-subtle">
                {kind === "page" ? t("create.pageHint") : t("short.createHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="px-4 pt-3">
            <CreateKindBar value={kind} onChange={onKind} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-6">
              <section>
                <p className="mb-1.5 text-xs font-medium">{t("short.destLabel")}</p>
                <Input
                  autoFocus
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={t("short.destPlaceholder")}
                />
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium">{t("short.nameLabel")}</p>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 text-[11px] text-fg-muted hover:text-fg"
                    onClick={() => setSlug(genToken(5))}
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
                      aria-haspopup="listbox"
                      aria-expanded={hostOpen}
                    >
                      <span className="min-w-0 truncate">{host}/</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                    </button>
                    {hostOpen && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-10"
                          aria-label={t("common.close")}
                          onClick={() => setHostOpen(false)}
                        />
                        <ul
                          role="listbox"
                          className="absolute left-0 top-full z-20 mt-1 min-w-[14rem] overflow-hidden rounded-md border border-border bg-bg-elevated py-1 shadow-lg"
                        >
                          {hosts.map((h) => (
                            <li key={h}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={h === host}
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
                    onChange={(e) =>
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))
                    }
                  />
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-medium text-fg-muted">{t("short.teamOnly")}</p>
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
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("short.notePh")}
                  className="min-h-[64px]"
                />
              </section>

              <section>
                <p className="mb-1.5 text-xs font-medium text-fg-muted">
                  {t("short.shareWhen")}
                </p>
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
                    <Mini
                      label={t("short.hoursUntil")}
                      value={expiresHours}
                      onChange={setExpiresHours}
                      type="number"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 flex-col gap-2 border-t border-border px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] @min-[28rem]/modal:flex-row @min-[28rem]/modal:items-center @min-[28rem]/modal:justify-between">
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
                  aria-haspopup="listbox"
                  aria-expanded={wsOpen}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{data.tenant.name}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                </button>
                {wsOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10"
                      aria-label={t("common.close")}
                      onClick={() => setWsOpen(false)}
                    />
                    <ul
                      role="listbox"
                      className="absolute bottom-full left-0 z-20 mb-1 min-w-[14rem] overflow-hidden rounded-md border border-border bg-bg-elevated py-1 shadow-lg"
                    >
                      {workspaces.map((w) => (
                        <li key={w.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={w.id === data.tenant.id}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg-subtle"
                            onMouseEnter={() => prefetchWorkspace(w.id)}
                            onClick={() => pickWorkspace(w.id)}
                          >
                            <span className="min-w-0 flex-1 truncate">{w.name}</span>
                            {w.id === data.tenant.id && (
                              <Check className="h-3 w-3 shrink-0 text-primary" />
                            )}
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
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[10px] text-bg opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col items-stretch gap-2 @min-[28rem]/modal:items-end">
              <Toggle label={t("dash.pin")} checked={pinDash} onChange={setPinDash} />
              {pinDash && (
                <select
                  className="h-8 rounded-md border border-border bg-bg px-2 text-[11px]"
                  value={dashDisplay}
                  onChange={(e) =>
                    setDashDisplay(e.target.value as "text" | "icon" | "preview")
                  }
                >
                  <option value="text">{t("dash.asText")}</option>
                  <option value="icon">{t("dash.asIcon")}</option>
                  <option value="preview">{t("dash.asPreview")}</option>
                </select>
              )}
              <Button className="h-9" disabled={busy} onClick={() => void save()}>
                {busy ? t("common.loading") : t("short.createBtn")}
              </Button>
            </div>
          </footer>
        </div>

        <QrDrawer url={shortUrl} slug={slug} />
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
