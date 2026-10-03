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
import { useT } from "@/lib/i18n";
import {
  BIO_PALETTE,
  bioHref,
  type BioNetwork,
  type BioPage,
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
  onOpen,
}: {
  page: BioPage;
  preview?: boolean;
  onOpen?: (url: string, linkId?: string) => void;
}) {
  const pal = BIO_PALETTE[page.theme];
  const t = useT();
  const name = page.name || "Visitenkarte";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  function open(url: string, linkId?: string) {
    const href = bioHref(url);
    if (!href) return;
    if (onOpen) onOpen(href, linkId);
    if (preview) return;
    window.location.assign(href);
  }

  return (
    <div
      className="bio-root relative min-h-dvh overflow-hidden"
      style={{ background: pal.bg, color: pal.fg, fontFamily: '"Instrument Sans", "DM Sans", system-ui, sans-serif' }}
    >
      <style>{`
        .bio-link { transition: transform .2s cubic-bezier(.2,.7,.2,1), background .2s ease; }
        .bio-link:hover { transform: translateY(-2px); }
        .bio-link:active { transform: scale(.985); }
        .bio-go { transition: transform .2s ease; }
        .bio-link:hover .bio-go { transform: translateX(3px); }
        .bio-rise { animation: bio-rise .55s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes bio-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .bio-link, .bio-go, .bio-rise { animation: none !important; transition: none !important; }
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(820px 480px at 50% -8%, ${pal.glow}, transparent 62%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(closest-side at 50% 20%, black, transparent)",
        }}
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-16 pt-14 sm:pt-20">
        <div className="bio-rise flex flex-col items-center text-center">
          {page.avatar_url ? (
            <img
              src={page.avatar_url}
              alt=""
              className="h-24 w-24 rounded-[28px] object-cover"
              style={{ boxShadow: `0 0 0 1px ${pal.line}, 0 24px 60px ${pal.glow}` }}
            />
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-[28px] text-2xl font-semibold tracking-tight"
              style={{
                background: pal.glass,
                color: pal.fg,
                boxShadow: `0 0 0 1px ${pal.line}`,
              }}
            >
              {initials || "·"}
            </div>
          )}
          <h1 className="mt-6 text-[2rem] font-semibold leading-none tracking-[-0.04em]">{name}</h1>
          {page.bio ? (
            <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed" style={{ color: pal.muted }}>
              {page.bio}
            </p>
          ) : null}
        </div>

        {page.socials.length > 0 && (
          <div className="bio-rise mt-6 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "80ms" }}>
            {page.socials.map((s) => {
              const Icon = SOCIAL_ICON[s.network];
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.network}
                  onClick={() => open(s.url)}
                  className="bio-link flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{
                    background: pal.glass,
                    color: pal.fg,
                    border: `1px solid ${pal.line}`,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {s.network === "x" ? (
                    <span className="text-[13px] font-semibold leading-none">X</span>
                  ) : (
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {page.links.map((l, i) => {
            const featured = l.highlight;
            const solid = featured || page.button === "solid";
            const line = !featured && page.button === "line";
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => open(l.url, l.id)}
                className="bio-link bio-rise group flex min-h-[58px] w-full items-center gap-3 px-4 text-left"
                style={{
                  animationDelay: `${120 + i * 45}ms`,
                  borderRadius: 18,
                  background: solid ? (featured ? pal.accent : pal.card) : pal.glass,
                  color: solid ? (featured ? pal.cardFg : pal.cardFg) : pal.fg,
                  border: line || page.button === "glass" ? `1px solid ${pal.line}` : "1px solid transparent",
                  backdropFilter: page.button === "glass" && !featured ? "blur(14px)" : undefined,
                  boxShadow: featured ? `0 16px 40px ${pal.glow}` : undefined,
                }}
              >
                <span className="min-w-0 flex-1">
                  {featured ? (
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] opacity-70">
                      {t("bio.highlight")}
                    </span>
                  ) : null}
                  <span className="block truncate text-[15px] font-medium tracking-[-0.02em]">{l.label}</span>
                </span>
                <ArrowUpRight className="bio-go h-4 w-4 shrink-0 opacity-70" />
              </button>
            );
          })}
        </div>

        {!page.hide_flag && (
          <a
            href={BRAND_HOME}
            className="mt-auto pt-12 text-center text-[11px] tracking-[0.14em] uppercase"
            style={{ color: pal.muted }}
          >
            {t("bio.made")}
          </a>
        )}
      </div>
    </div>
  );
}
