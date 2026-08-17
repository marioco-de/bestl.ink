import { useEffect, useState } from "react";
import {
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
import { createShort } from "@/lib/docbay/shorts-api";
import { genToken } from "@/lib/docbay/id";
import { cn } from "@/lib/utils";
import type { FullState } from "@/lib/docbay/types";
import { QrDrawer } from "./qr-drawer";
import { TagPicker } from "./tag-picker";
import { createTag } from "@/lib/docbay/api";

type Extra = "campaign" | "device" | "lock" | "ttl" | null;

export function CreateLinkModal() {
  const { data, setData, createOpen, createSeed, closeCreate } = useControl();
  if (!createOpen) return null;
  return (
    <Editor
      key={createSeed}
      data={data}
      seed={createSeed}
      onClose={closeCreate}
      onSaved={(s) => {
        setData(s);
        closeCreate();
      }}
    />
  );
}

function Editor({
  data,
  seed,
  onClose,
  onSaved,
}: {
  data: FullState;
  seed: string;
  onClose: () => void;
  onSaved: (s: FullState) => void;
}) {
  const host = data.tenant.public_host || "bestl.ink";
  const { setData } = useControl();
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

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
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
  }, [onClose]);

  const shortUrl = `https://${host}/${slug || "link"}`;

  async function save() {
    const dest = destination.trim();
    if (!dest) {
      toast.error("Wohin soll der Link führen?");
      return;
    }
    const withProto = /^https?:\/\//i.test(dest) ? dest : `https://${dest}`;
    setBusy(true);
    try {
      const next = await createShort({
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
      toast.success("Kurzlink liegt bereit");
      onSaved(next as FullState);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const extras: { id: Extra; label: string; icon: typeof Clock; on: boolean }[] = [
    { id: "campaign", label: "Kampagne", icon: Tag, on: Boolean(utmS || utmM || utmC) },
    { id: "device", label: "Gerät", icon: MonitorSmartphone, on: Boolean(ios || android) },
    { id: "lock", label: "Schutz", icon: KeyRound, on: Boolean(password) },
    { id: "ttl", label: "Ablauf", icon: Clock, on: Boolean(expiresHours) },
  ];

  return (
    <div className="@container/stage fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full items-center justify-center p-0 @min-[40rem]/stage:p-6 @min-[40rem]/stage:pr-14">
        <div className="relative flex h-full w-full max-w-none @min-[40rem]/stage:h-auto @min-[40rem]/stage:max-h-[min(88dvh,720px)] @min-[40rem]/stage:max-w-[34rem]">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kurzlink anlegen"
          className="@container/modal relative flex h-full min-w-0 w-full flex-col overflow-hidden bg-bg-elevated shadow-2xl @min-[40rem]/stage:h-auto @min-[40rem]/stage:max-h-[min(88dvh,720px)] @min-[40rem]/stage:rounded-xl @min-[40rem]/stage:border @min-[40rem]/stage:border-border"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Kurzlink anlegen
              </h2>
              <p className="text-[12px] text-fg-subtle">Eine Adresse. Der Rest ist Beiwerk.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-6">
              <section>
                <p className="mb-1.5 text-xs font-medium">Wohin soll er führen?</p>
                <Input
                  autoFocus
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="www.seite.de/angebot"
                />
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium">So heißt der Link</p>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 text-[11px] text-fg-muted hover:text-fg"
                    onClick={() => setSlug(genToken(5))}
                  >
                    <Shuffle className="h-3 w-3" /> würfeln
                  </button>
                </div>
                <div className="flex overflow-hidden rounded-md border border-border bg-bg">
                  <span className="flex max-w-[48%] shrink-0 items-center truncate border-r border-border bg-bg-subtle px-2.5 text-[11px] text-fg-muted">
                    {host}/
                  </span>
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
                <p className="text-xs font-medium text-fg-muted">Nur fürs Team</p>
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
                  placeholder="Wer bekommt den Link? z. B. Müller, Rückruf"
                  className="min-h-[64px]"
                />
              </section>

              <section>
                <p className="mb-1.5 text-xs font-medium text-fg-muted">
                  Wenn jemand den Link teilt
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
                      placeholder="Titel in WhatsApp & Co."
                      value={shareTitle}
                      onChange={(e) => setShareTitle(e.target.value)}
                    />
                    <input
                      className="w-full bg-transparent text-xs text-fg-muted outline-none"
                      placeholder="Ein Satz dazu"
                      value={shareText}
                      onChange={(e) => setShareText(e.target.value)}
                    />
                    <input
                      className="w-full bg-transparent text-[11px] text-fg-subtle outline-none"
                      placeholder="Bild-URL (optional)"
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
                      <Mini label="Quelle" value={utmS} onChange={setUtmS} />
                      <Mini label="Kanal" value={utmM} onChange={setUtmM} />
                      <Mini label="Name" value={utmC} onChange={setUtmC} />
                    </div>
                  )}
                  {extra === "device" && (
                    <div className="grid gap-2">
                      <Mini label="Andere URL auf dem iPhone" value={ios} onChange={setIos} />
                      <Mini label="Andere URL auf Android" value={android} onChange={setAndroid} />
                    </div>
                  )}
                  {extra === "lock" && (
                    <Mini label="Passwort zum Öffnen" value={password} onChange={setPassword} />
                  )}
                  {extra === "ttl" && (
                    <Mini
                      label="Stunden bis ungültig"
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
              {extras.map((c) => {
                const Icon = c.icon;
                const active = extra === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setExtra(active ? null : c.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] transition-colors",
                      active || c.on
                        ? "border-fg bg-fg text-bg"
                        : "border-border text-fg-muted hover:bg-bg-subtle hover:text-fg",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <Button className="h-9" disabled={busy} onClick={() => void save()}>
              {busy ? "…" : "Anlegen"}
            </Button>
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
