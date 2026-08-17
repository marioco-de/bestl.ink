import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useControlData } from "@/lib/docbay/use-control";
import { formatDateDe } from "@/lib/utils";

export const Route = createFileRoute("/control/audit")({
  component: AuditPage,
});

function AuditPage() {
  const data = useControlData();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Audit-Log</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Wer hat Links erzeugt, widerrufen, Anfragen bearbeitet. DSGVO-Nachweis.
        </p>
      </div>
      <div className="space-y-2">
        {data.audit.length === 0 && (
          <p className="text-sm text-fg-muted">Noch keine Einträge.</p>
        )}
        {data.audit.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:justify-between">
              <div>
                <p className="font-mono text-sm text-primary">{a.action}</p>
                <p className="text-xs text-fg-muted">
                  {JSON.stringify(a.meta)}
                </p>
              </div>
              <p className="shrink-0 text-xs text-fg-subtle">
                {formatDateDe(a.created_at)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-2 p-5 text-sm text-fg-muted">
          <p className="font-medium text-fg">Datenschutz</p>
          <ul className="list-inside list-disc space-y-1 text-xs">
            <li>Zugriffsanfragen speichern E-Mail/Telefon nur für Freigabe-Workflow</li>
            <li>IP-Adressen werden gehasht gespeichert</li>
            <li>Demo-Tenant löscht Daten stündlich automatisch</li>
            <li>Bot-Klicks (Safe Links etc.) werden getrennt gezählt</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
