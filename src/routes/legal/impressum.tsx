import { createFileRoute } from "@tanstack/react-router";
import { LegalScreen } from "@/components/public/legal-screen";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/legal/impressum")({
  component: Page,
});

function Page() {
  const t = useT();
  return <LegalScreen title={t("legal.imprint")} page="imprint" />;
}
