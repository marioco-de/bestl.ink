import { Link } from "@tanstack/react-router";
import { LegalLinks } from "@/components/public/legal-links";
import { useI18n, useT } from "@/lib/i18n";
import { LEGAL_PAGES, type LegalBlock } from "@/lib/docbay/legal";

export function LegalScreen({
  title,
  page,
}: {
  title: string;
  page: "imprint" | "privacy" | "a11y";
}) {
  const t = useT();
  const { locale } = useI18n();
  const pack = LEGAL_PAGES[locale] ?? LEGAL_PAGES.en;
  const blocks = pack[page] as readonly LegalBlock[];
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-16 text-fg">
      <p className="text-xs uppercase tracking-[0.14em] text-fg-subtle">BESTL.LINK</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-fg-muted">
        {blocks.map((block) => (
          <section key={block.title}>
            <h2 className="text-base font-medium text-fg">{block.title}</h2>
            {block.paragraphs.map((p) => (
              <p key={p} className="mt-2">{p}</p>
            ))}
          </section>
        ))}
      </div>
      <LegalLinks className="mt-10 text-xs text-fg-subtle" />
      <p className="mt-6 text-xs text-fg-subtle">
        <Link to="/" className="underline-offset-2 hover:underline">{t("legal.home")}</Link>
      </p>
    </main>
  );
}
