import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Music2,
  Youtube,
  type LucideIcon,
} from "lucide-react";
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
  paletteFor,
  shapeRadius,
  type BioLink,
  type BioNetwork,
  type BioPage,
  type BioPalette,
} from "@/lib/docbay/bio";

const SOCIAL_ICON: Record<BioNetwork, LucideIcon> = {
  instagram: Instagram,
  x: ArrowUpRight,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
  github: Github,
  spotify: Music2,
  whatsapp: MessageCircle,
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

  function go(link: BioLink) {
    if (link.sensitive && !preview) {
      setWarn(link);
      return;
    }
    const href = bioHref(link.url);
    if (!href) return;
    onOpen?.(href, link.id);
    if (preview) return;
    window.location.assign(href);
  }

  function visible(link: BioLink) {
    if (preview) return true;
    return linkAllowed(link, { device, country, hour });
  }

  const groups: { id: string; title: string; links: BioLink[] }[] = [];
  let current: { id: string; title: string; links: BioLink[] } = { id: "", title: "", links: [] };
  for (const link of page.links) {
    if (link.kind === "heading") {
      if (current.links.length || current.title) groups.push(current);
      current = { id: link.id, title: link.label, links: [] };
      continue;
    }
    if (visible(link)) current.links.push(link);
  }
  if (current.links.length || current.title) groups.push(current);
  const shown = groups.filter((g) => g.links.length || (preview && g.title));

  return (
    <div
      className="bio-root relative min-h-dvh overflow-hidden"
      style={{ background: bg, color: fg, fontFamily: BIO_FONT_STACK[page.font] }}
    >
      <style>{`
        .bio-link { transition: transform .2s cubic-bezier(.2,.7,.2,1), background .2s ease; }
        .bio-link:hover { transform: translateY(-2px); }
        .bio-spot { animation: bio-spot 1.6s ease-in-out infinite; }
        @keyframes bio-spot { 50% { transform: translateY(-2px) scale(1.02); } }
        @media (prefers-reduced-motion: reduce) {
          .bio-link, .bio-spot { animation: none !important; transition: none !important; }
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
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-16 pt-14 sm:pt-20">
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
            <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed opacity-70">{page.bio}</p>
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
                    window.location.assign(href);
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

        <div className={page.layout === "grid" ? "mt-8 grid grid-cols-2 gap-3" : page.layout === "cards" ? "mt-8 flex flex-col gap-5" : "mt-8 flex flex-col gap-3"}>
          {shown.map((g) => (
            <div key={g.id || "root"} className={page.layout === "grid" ? "contents" : "flex flex-col gap-3"}>
              {g.title ? (
                <p className="px-1 pt-2 text-[11px] font-medium uppercase tracking-[0.16em] opacity-60">{g.title}</p>
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
                  onGo={() => go(l)}
                  onSent={() => setSent((s) => ({ ...s, [l.id]: true }))}
                  host=""
                />
              ))}
            </div>
          ))}
        </div>

        {!page.hide_flag && (
          <a href={BRAND_HOME} className="mt-auto pt-12 text-center text-[11px] uppercase tracking-[0.14em] opacity-60">
            {t("bio.made")}
          </a>
        )}
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
  featured: boolean,
): CSSProperties {
  if (featured || page.button === "solid") {
    return {
      background: featured ? pal.accent : pal.card,
      color: pal.cardFg,
      border: "1px solid transparent",
      boxShadow: featured ? `0 16px 40px ${pal.glow}` : undefined,
    };
  }
  if (page.button === "line") {
    return {
      background: "transparent",
      color: fg,
      border: `1.5px solid ${fg}`,
      boxShadow: "none",
    };
  }
  const light = isLightHex(pal.bg);
  return {
    background: light ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.14)",
    color: fg,
    border: light ? "1px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.34)",
    boxShadow: light
      ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 10px 28px rgba(20,16,12,0.1)"
      : "inset 0 1px 0 rgba(255,255,255,0.38), 0 14px 34px rgba(0,0,0,0.32)",
    backdropFilter: "blur(18px) saturate(1.4)",
    WebkitBackdropFilter: "blur(18px) saturate(1.4)",
  };
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
  const minH = link.size === "s" ? 44 : link.size === "l" ? 84 : 58;
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
  const chrome = linkChrome(page, pal, fg, featured || link.spotlight);
  return (
    <button
      type="button"
      onClick={onGo}
      className={`bio-link flex w-full items-center gap-3 px-4 text-left ${link.spotlight ? "bio-spot" : ""}`}
      style={{
        minHeight: minH,
        borderRadius: radius,
        ...chrome,
      }}
    >
      {link.thumb_url ? (
        <img src={link.thumb_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{link.label}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />
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
