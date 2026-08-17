import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Globe2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useControlData } from "@/lib/docbay/use-control";
import { updateTenant } from "@/lib/docbay/api";
import { PLATFORM_LINK_HOST, CNAME_TARGET } from "@/lib/docbay/brand";

export const Route = createFileRoute("/control/domain")({
  component: DomainPage,
});

function DomainPage() {
  const data = useControlData();
  const router = useRouter();
  const [company, setCompany] = useState(data.tenant.brand_company || data.tenant.name);
  const [subdomain, setSubdomain] = useState(data.tenant.subdomain || data.tenant.slug);
  const [customDomain, setCustomDomain] = useState(data.tenant.custom_domain || "");
  const [connected, setConnected] = useState(data.tenant.custom_domain_connected);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCompany(data.tenant.brand_company || data.tenant.name);
    setSubdomain(data.tenant.subdomain || data.tenant.slug);
    setCustomDomain(data.tenant.custom_domain || "");
    setConnected(data.tenant.custom_domain_connected);
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateTenant({
        data: {
          brand_company: company.trim(),
          subdomain: subdomain.trim(),
          custom_domain: customDomain.trim(),
          custom_domain_connected: connected && Boolean(customDomain.trim()),
          tenant_id: data.tenant.id !== "platform" ? data.tenant.id : undefined,
        },
      });
      await router.invalidate();
      toast.success("Gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const platformHost = `${(subdomain || "firma").toLowerCase().replace(/[^a-z0-9-]/g, "")}.${PLATFORM_LINK_HOST}`;
  const cnameTarget = CNAME_TARGET;
  const publicHost = data.tenant.public_host;

  if (data.tenant.id === "platform") {
    return (
      <div className="mx-auto max-w-lg text-sm text-fg-muted">
        Wähle einen Kunden-Workspace, um Domains zu verwalten (Platform-Ansicht).
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Domain</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Jeder Workspace hat eine eigene {PLATFORM_LINK_HOST}-Subdomain und optional eine
          eigene Custom Domain (CNAME).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" /> Öffentliche Hosts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-bg p-3">
            <p className="text-xs uppercase text-fg-subtle">Platform-Subdomain</p>
            <p className="mt-1 font-mono text-primary">https://{platformHost}</p>
          </div>
          {customDomain && (
            <div className="rounded-md border border-border bg-bg p-3">
              <p className="text-xs uppercase text-fg-subtle">Custom Domain</p>
              <p className="mt-1 font-mono text-primary">https://{customDomain}</p>
              {connected ? (
                <Badge variant="success" className="mt-2">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Aktiv
                </Badge>
              ) : (
                <Badge variant="warning" className="mt-2">
                  DNS ausstehend
                </Badge>
              )}
            </div>
          )}
          <p className="text-xs text-fg-subtle">
            Aktuell primär: <span className="font-mono text-fg">{publicHost}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Einstellungen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>Firmenname (Branding)</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label>Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  className="font-mono"
                  placeholder="muster-gmbh"
                />
                <span className="shrink-0 text-xs text-fg-subtle">.{PLATFORM_LINK_HOST}</span>
              </div>
            </div>
            <div>
              <Label>Eigene Domain (optional)</Label>
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="font-mono"
                placeholder="docs.firma.de"
              />
            </div>
            {customDomain && (
              <div className="rounded-md border border-border bg-bg p-4 text-sm">
                <p className="text-xs uppercase text-fg-subtle">DNS (CNAME)</p>
                <p className="mt-2 font-mono">
                  {customDomain.split(".")[0] || "docs"} → {cnameTarget}
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
                  onClick={() => {
                    void navigator.clipboard.writeText(cnameTarget);
                    toast.success("Kopiert");
                  }}
                >
                  <Copy className="h-3 w-3" /> Ziel kopieren
                </button>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConnected(true);
                      toast.success("Als verbunden markiert");
                    }}
                  >
                    DNS prüfen
                  </Button>
                  {connected && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConnected(false)}
                    >
                      Trennen
                    </Button>
                  )}
                </div>
              </div>
            )}
            <Button type="submit" disabled={busy}>
              Speichern
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
