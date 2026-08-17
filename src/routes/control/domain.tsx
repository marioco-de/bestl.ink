import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Globe2, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useControlData, useSetControlData } from "@/lib/docbay/use-control";
import {
  addTenantDomain,
  removeTenantDomain,
  updateTenant,
  updateTenantDomain,
} from "@/lib/docbay/api";
import { PLATFORM_LINK_HOST, CNAME_TARGET } from "@/lib/docbay/brand";
import { TagPicker } from "@/components/control/tag-picker";
import { createTag } from "@/lib/docbay/api";
import type { FullState } from "@/lib/docbay/types";

export const Route = createFileRoute("/control/domain")({
  component: DomainPage,
});

function DomainPage() {
  const data = useControlData();
  const setGlobal = useSetControlData();
  const router = useRouter();
  const [company, setCompany] = useState(data.tenant.brand_company || data.tenant.name);
  const [subdomain, setSubdomain] = useState(data.tenant.subdomain || data.tenant.slug);
  const [newHost, setNewHost] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCompany(data.tenant.brand_company || data.tenant.name);
    setSubdomain(data.tenant.subdomain || data.tenant.slug);
  }, [data]);

  async function refresh(s: FullState) {
    setGlobal?.(s);
    await router.invalidate();
  }

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const s = (await updateTenant({
        data: {
          brand_company: company.trim(),
          subdomain: subdomain.trim(),
          tenant_id: data.tenant.id !== "platform" ? data.tenant.id : undefined,
        },
      })) as FullState;
      await refresh(s);
      toast.success("Gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function addDomain() {
    const host = newHost.trim();
    if (!host) return;
    setBusy(true);
    try {
      const s = (await addTenantDomain({
        data: { host, tenant_id: data.tenant.id },
      })) as FullState;
      setNewHost("");
      await refresh(s);
      toast.success("Domain hinzugefügt");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (data.tenant.id === "platform") {
    return (
      <div className="mx-auto max-w-lg text-sm text-fg-muted">
        Wähle einen Workspace, um Domains zu verwalten.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Domains</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Mehrere eigene Hosts pro Workspace. Kurzlinks laufen über {PLATFORM_LINK_HOST}
          oder eine verbundene Domain.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" /> Angeschlossene Hosts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-bg p-3">
            <p className="text-xs uppercase text-fg-subtle">Platform</p>
            <p className="mt-1 font-mono text-primary">https://{PLATFORM_LINK_HOST}/…</p>
          </div>
          {data.domains.map((d) => (
            <div key={d.id} className="space-y-2 rounded-md border border-border bg-bg p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-primary">https://{d.host}</p>
                <div className="flex items-center gap-1">
                  {d.connected ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Aktiv
                    </Badge>
                  ) : (
                    <Badge variant="warning">DNS ausstehend</Badge>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const s = (await updateTenantDomain({
                        data: { id: d.id, connected: !d.connected, tenant_id: data.tenant.id },
                      })) as FullState;
                      await refresh(s);
                    }}
                  >
                    {d.connected ? "Trennen" : "Aktivieren"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const s = (await removeTenantDomain({
                        data: { id: d.id, tenant_id: data.tenant.id },
                      })) as FullState;
                      await refresh(s);
                      toast.success("Domain entfernt");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              </div>
              <p className="font-mono text-[11px] text-fg-subtle">
                {d.host.split(".")[0] || "www"} → {CNAME_TARGET}
                <button
                  type="button"
                  className="ml-2 inline-flex items-center gap-1 text-primary"
                  onClick={() => {
                    void navigator.clipboard.writeText(CNAME_TARGET);
                    toast.success("Kopiert");
                  }}
                >
                  <Copy className="h-3 w-3" /> CNAME
                </button>
              </p>
              <TagPicker
                catalog={data.tags}
                value={d.tags}
                onChange={(tags) => {
                  void updateTenantDomain({
                    data: { id: d.id, tags, tenant_id: data.tenant.id },
                  }).then((s) => refresh(s as FullState));
                }}
                onCreate={async (name, color) => {
                  const s = (await createTag({
                    data: { name, color, tenant_id: data.tenant.id },
                  })) as FullState;
                  await refresh(s);
                }}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              className="font-mono"
              placeholder="go.firma.de"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addDomain();
                }
              }}
            />
            <Button type="button" disabled={busy} onClick={() => void addDomain()}>
              <Plus className="h-4 w-4" /> Domain
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveBrand} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label>Kürzel</Label>
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
            <Button type="submit" disabled={busy}>
              Speichern
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
