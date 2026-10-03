import { useEffect, useState, type CSSProperties, type ComponentType } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Music2,
} from "lucide-react";
import { BioGlyph } from "@/components/public/bio-icons";
import { LegalLinks } from "@/components/public/legal-links";
import { BRAND_HOME } from "@/lib/docbay/brand";
import { submitBioLead } from "@/lib/docbay/api";
import { useT } from "@/lib/i18n";
import {
  BIO_FONT_STACK,
  BIO_PALETTE,
  bioHref,
  deviceFromUa,
  embedSrc,
  isLightHex,
  linkAllowed,
  pageGlow,
  lineWidth,
  paletteFor,
  shapeRadius,
  type BioLink,
  type BioNetwork,
  type BioPage,
  type BioPalette,
} from "@/lib/docbay/bio";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8.2v7.6l6.2-3.8-6.2-3.8z" fill="currentColor" />
    </svg>
  );
}

const SOCIAL_ICON: Record<BioNetwork, ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  x: ArrowUpRight,
  linkedin: Linkedin,
  youtube: YouTubeIcon,
  tiktok: Music2,
  github: Github,
  spotify: Music2,
  whatsapp: WhatsAppIcon,
  mail: Mail,
  web: Globe,
};

export function BioStage({
  page,
  preview,
  country = "",
  onOpen,
}: {
  page: BioPage;
  preview?: boolean;
  country?: string;
  onOpen?: (url: string, linkId?: string) => void;
}) {
  const pal = paletteFor(page);
  const t = useT();
  const bg = page.bg_color || pal.bg;
  const fg = page.fg_color || pal.fg;
  const name = page.name || "eCard";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  const [warn, setWarn] = useState<BioLink | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [folderId, setFolderId] = useState<string | null>(null);
  const [motion, setMotion] = useState<{ from: string | null; to: string | null; dir: 1 | -1 } | null>(null);
  const device = typeof navigator === "undefined" ? "desktop" : deviceFromUa(navigator.userAgent);
  const hour = new Date().getHours();
  const video = page.bg_video_url ? embedSrc(page.bg_video_url) : null;

  useEffect(() => {
    if (preview) return;
    if (page.ga_id) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${page.ga_id}`;
      document.head.appendChild(s);
      const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag() {
        w.dataLayer?.push(arguments);
      };
      w.gtag("js", new Date());
      w.gtag("config", page.ga_id);
    }
    if (page.pixel_id && !document.getElementById("ecard-pixel")) {
      const s = document.createElement("script");
      s.id = "ecard-pixel";
      s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${page.pixel_id}');fbq('track','PageView');`;
      document.head.appendChild(s);
    }
  }, [page.ga_id, page.pixel_id, preview]);

  useEffect(() => {
    setFolderId(null);
    setMotion(null);
  }, [page.id]);

  function shift(to: string | null, dir: 1 | -1) {
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || motion) {
      setFolderId(to);
      setMotion(null);
      return;
    }
    setMotion({ from: folderId, to, dir });
    setFolderId(to);
    window.setTimeout(() => setMotion(null), 360);
  }

  function go(link: BioLink) {
    if (link.sensitive && !preview) {
      setWarn(link);
      return;
    }
    const href = bioHref(link.url);
    if (!href) return;
    onOpen?.(href, link.id);
    if (preview) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function visible(link: BioLink) {
    if (preview) return true;
    return linkAllowed(link, { device, country, hour });
  }

  function groupsFor(parent: string | null) {
    const items = page.links.filter((l) => (l.parent_id || "") === (parent || ""));
    const groups: { id: string; title: string; links: BioLink[] }[] = [];
    let current: { id: string; title: string; links: BioLink[] } = { id: "", title: "", links: [] };
    for (const link of items) {
      if (link.kind === "heading") {
        if (current.links.length || current.title) groups.push(current);
        current = { id: link.id, title: link.label, links: [] };
        continue;
      }
      if (visible(link)) current.links.push(link);
    }
    if (current.links.length || current.title) groups.push(current);
    return groups.filter((g) => g.links.length || (preview && g.title));
  }

  function sheet(parent: string | null) {
    const folder = parent ? page.links.find((l) => l.id === parent && l.kind === "folder") : null;
    const shown = groupsFor(parent);
    return (
      <div>
        {folder ? (
          <button
            type="button"
            onClick={() => shift(null, -1)}
            className="mb-4 flex items-center gap-2 text-sm font-medium"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="truncate">{folder.label || t("bio.folder")}</span>
          </button>
        ) : null}
        {shown.length === 0 ? (
          parent ? <p className="px-1 text-sm opacity-60">{t("bio.emptyFolder")}</p> : null
        ) : (
          <div className={`pt-2 ${page.layout === "grid" ? "grid grid-cols-2 gap-3" : page.layout === "cards" ? "flex flex-col gap-5" : "flex flex-col gap-3"}`}>
            {shown.map((g) => (
              <div key={g.id || "root"} className={page.layout === "grid" ? "contents" : "flex flex-col gap-3"}>
                {g.title ? (
                  <p className={`px-1 pt-2 text-[11px] font-medium uppercase tracking-[0.16em] opacity-60 ${page.layout === "grid" ? "col-span-full" : ""}`}>
                    {g.title}
                  </p>
                ) : null}
                {g.links.map((l) => (
                  <Block
                    key={l.id}
                    link={l}
                    page={page}
                    pal={pal}
                    fg={fg}
                    preview={preview}
                    sent={Boolean(sent[l.id])}
                    onGo={() => {
                      if (l.kind === "folder") {
                        if (!preview) onOpen?.("#folder", l.id);
                        shift(l.id, 1);
                        return;
                      }
                      go(l);
                    }}
                    onSent={() => setSent((s) => ({ ...s, [l.id]: true }))}
                    host=""
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="bio-root relative min-h-dvh overflow-hidden"
      style={{ background: bg, color: fg, fontFamily: BIO_FONT_STACK[page.font] }}
    >
      <style>{`
        .bio-link { transition: transform .2s cubic-bezier(.2,.7,.2,1), background .2s ease; touch-action: manipulation; }
        @media (hover: hover) and (pointer: fine) {
          .bio-link:hover { transform: translateY(-2px); }
        }
        .bio-glass { position: relative; isolation: isolate; }
        .bio-plate {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          border-radius: inherit;
          pointer-events: none;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.28),
            inset 0 -1px 0 rgba(255,255,255,0.08);
          -webkit-backdrop-filter: blur(12px) saturate(1.6);
          backdrop-filter: blur(12px) saturate(1.6);
        }
        .bio-glass-light .bio-plate {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.28);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.4),
            inset 0 -1px 0 rgba(255,255,255,0.12);
        }
        .bio-plate::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 16%);
          pointer-events: none;
        }
        .bio-glass > :not(.bio-plate) { position: relative; z-index: 1; }
        .bio-spot { animation: bio-spot 1.6s ease-in-out infinite; }
        @keyframes bio-spot { 50% { transform: translateY(-2px) scale(1.02); } }
        @keyframes bio-out-left { to { transform: translateX(-105%); } }
        @keyframes bio-in-right { from { transform: translateX(105%); } to { transform: none; } }
        @keyframes bio-out-right { to { transform: translateX(105%); } }
        @keyframes bio-in-left { from { transform: translateX(-105%); } to { transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .bio-link, .bio-spot, .bio-slide { animation: none !important; transition: none !important; }
        }
      `}</style>
      {page.bg_image_url ? (
        <img src={page.bg_image_url} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : null}
      {video ? (
        <iframe
          title=""
          src={`${video}?autoplay=1&mute=1`}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          allow="autoplay"
        />
      ) : page.bg_video_url && /\.(mp4|webm)(\?|$)/i.test(page.bg_video_url) ? (
        <video src={page.bg_video_url} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" autoPlay muted loop playsInline />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(820px 480px at 50% -8%, ${pageGlow(page, pal)}, transparent 62%)` }}
      />
      <div className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-16 pt-14 sm:pt-20">
        <div className="flex flex-col items-center text-center">
          {page.header === "logo" && page.logo_url ? (
            <img src={page.logo_url} alt="" className="max-h-16 max-w-[220px] object-contain" />
          ) : page.avatar_url ? (
            <img
              src={page.avatar_url}
              alt=""
              className={page.header === "hero" ? "h-40 w-40 rounded-[36px] object-cover" : "h-24 w-24 rounded-[28px] object-cover"}
              style={{ boxShadow: `0 0 0 1px ${pal.line}, 0 24px 60px ${pageGlow(page, pal)}` }}
            />
          ) : (
            <div
              className={`flex items-center justify-center font-semibold ${page.header === "hero" ? "h-40 w-40 rounded-[36px] text-4xl" : "h-24 w-24 rounded-[28px] text-2xl"}`}
              style={{ background: pal.glass, boxShadow: `0 0 0 1px ${pal.line}` }}
            >
              {initials || "·"}
            </div>
          )}
          <h1 className="mt-6 text-[2rem] font-semibold leading-none tracking-[-0.04em]">{name}</h1>
          {page.bio ? (
            <p className="mt-3 max-w-[34ch] whitespace-pre-line text-[15px] leading-relaxed opacity-70">{page.bio}</p>
          ) : null}
        </div>

        {page.socials.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {page.socials.map((s) => {
              const Icon = SOCIAL_ICON[s.network];
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.network}
                  onClick={() => {
                    const href = bioHref(s.url);
                    if (!href) return;
                    onOpen?.(href);
                    if (preview) return;
                    window.open(href, "_blank", "noopener,noreferrer");
                  }}
                  className="bio-link flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ background: pal.glass, border: `1px solid ${pal.line}` }}
                >
                  {s.network === "x" ? <span className="text-[13px] font-semibold">X</span> : <Icon className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="relative mt-8 overflow-hidden">
          {motion ? (
            <div
              className="bio-slide pointer-events-none absolute inset-x-0 top-0"
              style={{ animation: `${motion.dir === 1 ? "bio-out-left" : "bio-out-right"} .34s cubic-bezier(.22,.7,.2,1) forwards` }}
            >
              {sheet(motion.from)}
            </div>
          ) : null}
          <div
            className={motion ? "bio-slide" : undefined}
            style={motion ? { animation: `${motion.dir === 1 ? "bio-in-right" : "bio-in-left"} .34s cubic-bezier(.22,.7,.2,1)` } : undefined}
          >
            {sheet(folderId)}
          </div>
        </div>

        {(page.impressum_url || page.privacy_url) && (
          <nav className={`${page.hide_flag ? "mt-auto pt-12" : "mt-8"} flex flex-wrap justify-center gap-x-4 text-[12px] opacity-70`}>
            {page.impressum_url ? (
              <a href={page.impressum_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{t("legal.imprint")}</a>
            ) : null}
            {page.privacy_url ? (
              <a href={page.privacy_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{t("legal.privacy")}</a>
            ) : null}
          </nav>
        )}
        {!page.hide_flag && (
          <a href={BRAND_HOME} target="_blank" rel="noopener noreferrer" className={`${page.impressum_url || page.privacy_url ? "mt-6" : "mt-auto pt-12"} text-center text-[11px] uppercase tracking-[0.14em] opacity-60`}>
            {t("bio.made")}
          </a>
        )}
        <LegalLinks className={`${page.hide_flag && !(page.impressum_url || page.privacy_url) ? "mt-auto pt-12" : "mt-3"} justify-center text-[11px] opacity-50`} />
      </div>

      {warn && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: bg, color: fg }}>
            <p className="text-sm">{t("bio.warn")}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: pal.line }} onClick={() => setWarn(null)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: pal.card, color: pal.cardFg }}
                onClick={() => {
                  const link = { ...warn, sensitive: false };
                  setWarn(null);
                  go(link);
                }}
              >
                {t("bio.openAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function linkChrome(
  page: BioPage,
  pal: BioPalette,
  fg: string,
  highlight: boolean,
  spotlight: boolean,
): CSSProperties {
  if (spotlight) {
    return {
      background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.88) 100%)",
      color: "#1a1814",
      border: "1px solid rgba(255,255,255,0.95)",
      boxShadow: "inset 0 1px 0 #fff, 0 14px 36px rgba(255,255,255,0.35), 0 10px 24px rgba(20,16,12,0.12)",
    };
  }
  if (highlight || page.button === "solid") {
    return {
      background: highlight ? pal.accent : pal.card,
      color: pal.cardFg,
      border: "1px solid transparent",
      boxShadow: highlight ? `0 16px 40px ${pal.glow}` : undefined,
    };
  }
  if (page.button === "line") {
    const width = lineWidth(page.line_width);
    return {
      background: "transparent",
      color: fg,
      border: `${width}px solid ${fg}`,
      boxShadow: "none",
    };
  }
  return { color: fg };
}

function Block({
  link,
  page,
  pal,
  fg,
  preview,
  sent,
  onGo,
  onSent,
}: {
  link: BioLink;
  page: BioPage;
  pal: (typeof BIO_PALETTE)[keyof typeof BIO_PALETTE];
  fg: string;
  preview?: boolean;
  sent: boolean;
  onGo: () => void;
  onSent: () => void;
  host: string;
}) {
  const shape = link.shape || page.button_shape;
  const radius = shapeRadius(shape);
  const minH = link.kind === "folder" ? 86 : link.size === "s" ? 44 : link.size === "l" ? 84 : 58;
  const embed = link.kind === "embed" ? embedSrc(link.url) : null;
  if (embed) {
    return (
      <iframe
        title={link.label || "embed"}
        src={embed}
        className="w-full rounded-2xl"
        style={{ height: link.size === "l" ? 220 : 152, border: `1px solid ${pal.line}` }}
        allow="autoplay; encrypted-media"
      />
    );
  }
  if (link.kind === "form" || link.kind === "capture" || link.kind === "subscribe" || link.kind === "booking") {
    return (
      <Lead
        link={link}
        page={page}
        pal={pal}
        fg={fg}
        sent={sent}
        preview={preview}
        onSent={onSent}
      />
    );
  }
  const featured = link.highlight;
  const chrome = linkChrome(page, pal, fg, featured, link.spotlight);
  return (
    <button
      type="button"
      onClick={onGo}
      className={`bio-link flex w-full items-center gap-3 px-4 text-left ${link.spotlight ? "bio-spot" : ""} ${!featured && !link.spotlight && page.button === "glass" ? `bio-glass${isLightHex(pal.bg) ? " bio-glass-light" : ""}` : ""}`}
      style={{
        minHeight: minH,
        borderRadius: radius,
        ...chrome,
      }}
    >
      {!featured && !link.spotlight && page.button === "glass" ? <span className="bio-plate" aria-hidden /> : null}
      {link.thumb_url ? (
        <img src={link.thumb_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
      ) : link.icon || link.kind === "folder" ? (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(127,127,127,0.12)", color: link.icon_color || undefined }}>
          <BioGlyph name={link.icon || "folder"} className="h-4 w-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{link.label}</span>
      </span>
      {link.kind === "folder" ? (
        <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
      ) : (
        <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />
      )}
    </button>
  );
}

function Lead({
  link,
  page,
  pal,
  sent,
  preview,
  onSent,
}: {
  link: BioLink;
  page: BioPage;
  pal: (typeof BIO_PALETTE)[keyof typeof BIO_PALETTE];
  fg: string;
  sent: boolean;
  preview?: boolean;
  onSent: () => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const showEmail = link.kind !== "capture" || link.capture !== "phone";
  const showPhone = link.kind === "capture" ? link.capture !== "email" : link.kind === "booking";
  if (sent) {
    return <p className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: pal.line }}>{t("bio.sent")}</p>;
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border p-3"
      style={{ borderColor: pal.line, background: pal.glass }}
      onSubmit={(e) => {
        e.preventDefault();
        if (preview || !page.slug) {
          onSent();
          return;
        }
        setBusy(true);
        void submitBioLead({
          data: {
            slug: page.slug,
            host: window.location.host,
            kind: link.kind === "form" || link.kind === "booking" || link.kind === "subscribe" ? link.kind : "capture",
            name,
            email,
            phone,
            message,
            when_text: when,
          },
        })
          .then(() => onSent())
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-sm font-medium">{link.label}</p>
      {(link.kind === "form" || link.kind === "booking") && (
        <input className="h-9 rounded-lg border bg-transparent px-2 text-sm" style={{ borderColor: pal.line }} placeholder={t("bio.leadName")} value={name} onChange={(e) => setName(e.target.value)} />
      )}
      {showEmail && (
        <input className="h-9 rounded-lg border bg-transparent px-2 text-sm" style={{ borderColor: pal.line }} placeholder={t("bio.leadEmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
      )}
      {showPhone && (
        <input className="h-9 rounded-lg border bg-transparent px-2 text-sm" style={{ borderColor: pal.line }} placeholder={t("bio.leadPhone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
      )}
      {link.kind === "booking" && (
        <input className="h-9 rounded-lg border bg-transparent px-2 text-sm" style={{ borderColor: pal.line }} placeholder={t("bio.leadWhen")} value={when} onChange={(e) => setWhen(e.target.value)} />
      )}
      {(link.kind === "form" || link.kind === "booking") && (
        <textarea className="rounded-lg border bg-transparent px-2 py-1 text-sm" style={{ borderColor: pal.line }} rows={2} placeholder={t("bio.leadMessage")} value={message} onChange={(e) => setMessage(e.target.value)} />
      )}
      <button type="submit" disabled={busy} className="h-9 rounded-lg text-sm font-medium" style={{ background: pal.card, color: pal.cardFg }}>
        {link.kind === "booking" ? t("bio.book") : link.kind === "subscribe" ? t("bio.subscribe") : t("bio.send")}
      </button>
    </form>
  );
}
