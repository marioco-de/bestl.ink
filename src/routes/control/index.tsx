import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/control/dashboard-view";
import { QuickShorten } from "@/components/control/quick-shorten";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/control/")({
  component: DashboardPage,
});

function DashboardPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div className="sr-only">{t("dash.title")}</div>
      <QuickShorten />
      <DashboardView />
    </div>
  );
}
