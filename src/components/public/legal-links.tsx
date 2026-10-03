import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";

const ITEMS = [
  ["/legal/impressum", "legal.imprint"],
  ["/legal/datenschutz", "legal.privacy"],
  ["/legal/barrierefreiheit", "legal.a11y"],
  ["/legal/melden", "legal.report"],
] as const;

export function LegalLinks({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <nav aria-label={t("legal.nav")} className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {ITEMS.map(([to, key]) => (
        <Link key={to} to={to} className="underline-offset-2 hover:underline">
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
