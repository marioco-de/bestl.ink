import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useControlData } from "@/lib/docbay/use-control";
import { updateRequestStatus } from "@/lib/docbay/api";
import { formatDateDe } from "@/lib/utils";
import type { FullState } from "@/lib/docbay/types";
import { QuickShorten } from "@/components/control/quick-shorten";

export const Route = createFileRoute("/control/requests")({
  component: RequestsPage,
});

function RequestsPage() {
  const data = useControlData();
  const router = useRouter();
  const [state, setState] = useState(data);
  useEffect(() => setState(data), [data]);

  async function refresh(s: FullState | null) {
    if (s) setState(s);
    await router.invalidate();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Zugriffsanfragen</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Bei Genehmigung: Access-Link + E-Mail (Template + Provider).
        </p>
      </div>
      <QuickShorten />
      <div className="space-y-3">
        {state.requests.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-fg-muted">
              Keine Anfragen.
            </CardContent>
          </Card>
        )}
        {state.requests.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.resource_title}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm">
                    <Mail className="h-3.5 w-3.5 text-fg-subtle" />
                    {r.email}
                  </p>
                  {r.phone && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
                      <Phone className="h-3.5 w-3.5" />
                      {r.phone}
                    </p>
                  )}
                  {r.message && (
                    <p className="mt-2 flex gap-1.5 text-sm text-fg-muted">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {r.message}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-fg-subtle">
                    {formatDateDe(r.created_at)}
                  </p>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        const s = await updateRequestStatus({
                          data: {
                            id: r.id,
                            status: "approved",
                            origin: window.location.origin,
                          },
                        });
                        await refresh(s as FullState);
                        toast.success("Genehmigt – E-Mail wird versendet");
                      }}
                    >
                      Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const s = await updateRequestStatus({
                          data: { id: r.id, status: "rejected" },
                        });
                        await refresh(s as FullState);
                      }}
                    >
                      Ablehnen
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="success">Genehmigt</Badge>;
  if (status === "rejected") return <Badge variant="danger">Abgelehnt</Badge>;
  return <Badge variant="warning">Offen</Badge>;
}
