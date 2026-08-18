import { createFileRoute } from "@tanstack/react-router";
import { QuickShorten } from "@/components/control/quick-shorten";
import { WorkspaceSettings } from "@/components/control/workspace-settings";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/control/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t("nav.workspace")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("dash.hint")}</p>
      </div>
      <QuickShorten />
      <WorkspaceSettings />
    </div>
  );
}
