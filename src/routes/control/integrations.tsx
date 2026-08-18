import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { useControlData } from "@/lib/docbay/use-control";
import { saveWebhook, deleteWebhook } from "@/lib/docbay/api";
import { QuickShorten } from "@/components/control/quick-shorten";

export const Route = createFileRoute("/control/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const data = useControlData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data.features.webhooks) {
    return (
      <div className="mx-auto max-w-lg text-sm text-fg-muted">
        Webhooks sind für diesen Account deaktiviert (Super Admin).
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Integrationen</h1>
          <p className="mt-1 text-sm text-fg-muted">
            CRM-Webhooks bei click, access_request, access_approved.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Webhook
        </Button>
      </div>
      <QuickShorten />
      <div className="space-y-2">
        {data.webhooks.length === 0 && (
          <p className="text-sm text-fg-muted">Noch keine Webhooks.</p>
        )}
        {data.webhooks.map((w) => (
          <Card key={w.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">{w.url}</p>
                <p className="text-xs text-fg-subtle">{w.events.join(", ")}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await deleteWebhook({ data: { id: w.id } });
                  await router.invalidate();
                }}
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {open && (
        <FullScreenModal
          title="Webhook hinzufügen"
          description="Wird bei Klick, Zugriffsanfrage und Freigabe aufgerufen."
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                className="min-h-11"
                disabled={busy}
                onClick={async () => {
                  if (!url.trim()) {
                    toast.error("URL erforderlich");
                    return;
                  }
                  setBusy(true);
                  try {
                    await saveWebhook({
                      data: { url: url.trim(), secret: secret || undefined },
                    });
                    setUrl("");
                    setSecret("");
                    setOpen(false);
                    await router.invalidate();
                    toast.success("Webhook angelegt");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Fehler");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "…" : "Anlegen"}
              </Button>
            </>
          }
        >
          <div>
            <Label>URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
              autoFocus
            />
          </div>
          <div>
            <Label>Secret (optional)</Label>
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
        </FullScreenModal>
      )}
    </div>
  );
}
