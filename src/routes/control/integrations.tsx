import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { useControlData } from "@/lib/docbay/use-control";
import { saveWebhook, deleteWebhook, listWebhookLog, retryWebhookLog } from "@/lib/docbay/api";
import { cn } from "@/lib/utils";
import type { FullState } from "@/lib/docbay/types";

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
            CRM-Webhooks bei click, access_request, access_approved. Fehlgeschlagene
            Zustellungen werden wiederholt.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Webhook
        </Button>
      </div>

      <div className="space-y-2">
        {data.webhooks.length === 0 && (
          <p className="text-sm text-fg-muted">Noch keine Webhooks.</p>
        )}
        {data.webhooks.map((w) => (
          <WebhookCard
            key={w.id}
            w={w}
            tenantId={data.tenant.id}
            onDelete={async () => {
              await deleteWebhook({ data: { id: w.id } });
              await router.invalidate();
            }}
          />
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

function WebhookCard({
  w,
  tenantId,
  onDelete,
}: {
  w: FullState["webhooks"][number];
  tenantId: string;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listWebhookLog>> | null>(null);

  async function load() {
    const list = await listWebhookLog({ data: { id: w.id, tenant_id: tenantId } });
    setRows(list);
  }

  useEffect(() => {
    if (open) void load().catch(() => setRows([]));
  }, [open, w.id, tenantId]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((v) => !v)}>
            <p className="truncate font-mono text-sm">{w.url}</p>
            <p className="text-xs text-fg-subtle">{w.events.join(", ")}</p>
          </button>
          <Button size="sm" variant="ghost" onClick={() => void onDelete()}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
        {open && (
          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
              <p className="text-[11px] font-medium text-fg-muted">Zustellungen</p>
              <button type="button" className="text-[11px] text-fg-muted hover:text-fg" onClick={() => void load()}>
                Aktualisieren
              </button>
            </div>
            {!rows && <p className="px-3 py-3 text-xs text-fg-subtle">Lade…</p>}
            {rows && rows.length === 0 && (
              <p className="px-3 py-3 text-xs text-fg-subtle">Noch keine Zustellungen.</p>
            )}
            {rows && rows.length > 0 && (
              <ul className="max-h-56 overflow-auto text-xs">
                {rows.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-start justify-between gap-2 border-t border-border/70 px-3 py-2 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                            d.status === "ok"
                              ? "bg-hue-lime/15 text-hue-lime"
                              : "bg-danger/10 text-danger",
                          )}
                        >
                          {d.status}
                        </span>
                        <span className="font-mono">{d.event}</span>
                        <span className="text-fg-subtle">×{d.attempts}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-fg-subtle">
                        {d.created_at.slice(0, 16).replace("T", " ")}
                        {d.last_error ? ` · ${d.last_error}` : ""}
                      </p>
                    </div>
                    {d.status !== "ok" && (
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-bg-subtle"
                        onClick={async () => {
                          await retryWebhookLog({ data: { id: d.id, tenant_id: tenantId } });
                          toast.success("Erneut gesendet");
                          await load();
                        }}
                      >
                        <RotateCw className="h-3 w-3" /> Retry
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
