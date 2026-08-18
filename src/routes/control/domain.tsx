import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Globe2, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
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
  verifyTenantDomain,
  reorderTenantDomains,
  createTag,
} from "@/lib/docbay/api";
import { PLATFORM_LINK_HOST, CNAME_TARGET } from "@/lib/docbay/brand";
import { TagPicker } from "@/components/control/tag-picker";
import type { FullState, TenantDomain } from "@/lib/docbay/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control/domain")({
  component: DomainPage,
});

function DomainPage() {
  const data = useControlData();
  const setGlobal = useSetControlData();
  const [company, setCompany] = useState(data.tenant.brand_company || data.tenant.name);
  const [subdomain, setSubdomain] = useState(data.tenant.subdomain || data.tenant.slug);
  const [newHost, setNewHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const scanned = useRef<string>("");

  useEffect(() => {
    setCompany(data.tenant.brand_company || data.tenant.name);
    setSubdomain(data.tenant.subdomain || data.tenant.slug);
  }, [data]);

  function patch(next: FullState) {
    setGlobal?.(next);
  }

  function patchDomain(domain: TenantDomain, extra?: Partial<FullState["tenant"]>) {
    if (!setGlobal) return;
    const domains = data.domains.map((d) => (d.id === domain.id ? domain : d));
    const tenant = extra
      ? { ...data.tenant, ...extra }
      : domain.connected
        ? {
            ...data.tenant,
            custom_domain: domain.host,
            custom_domain_connected: true,
            public_host: domain.host,
          }
        : data.tenant;
    setGlobal({ ...data, domains, tenant });
  }

  async function checkDns(id: string, silent = false) {
    setChecking(id);
    try {
      const res = await verifyTenantDomain({
        data: { id, tenant_id: data.tenant.id },
      });
      patchDomain(res.domain);
      if (!silent) {
        toast[res.ok ? "success" : "message"](
          res.ok ? `${res.domain.host} ist aktiv` : res.detail || "DNS noch ausstehend",
        );
      } else if (res.ok) {
        toast.success(`${res.domain.host} ist aktiv`);
      }
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Prüfung fehlgeschlagen");
    } finally {
      setChecking((cur) => (cur === id ? null : cur));
    }
  }

  useEffect(() => {
    const key = `${data.tenant.id}:${data.domains.map((d) => d.id).join(",")}`;
    if (scanned.current === key) return;
    const pending = data.domains.filter((d) => !d.connected);
    if (pending.length === 0) {
      scanned.current = key;
      return;
    }
    scanned.current = key;
    for (const d of pending) void checkDns(d.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tenant.id, data.domains.length]);

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
      patch(s);
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
      patch(s);
      toast.success("Domain hinzugefügt");
      const added = s.domains.find(
        (d) => d.host === host.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase(),
      );
      if (added) void checkDns(added.id, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = [...data.domains];
    const from = list.findIndex((d) => d.id === fromId);
    const to = list.findIndex((d) => d.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    const ordered = list.map((d, i) => ({ ...d, sort_order: i }));
    setGlobal?.({ ...data, domains: ordered });
    void reorderTenantDomains({
      data: { ids: ordered.map((d) => d.id), tenant_id: data.tenant.id },
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Reihenfolge nicht gespeichert");
    });
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
          Ziehen zum Sortieren — dieselbe Reihenfolge gilt beim Anlegen eines Kurzlinks.
          Kurzlinks laufen über {PLATFORM_LINK_HOST} oder eine verbundene Domain.
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
            <div
              key={d.id}
              draggable
              onDragStart={(e) => {
                setDragId(d.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, d.id);
                setDragId(null);
              }}
              className={cn(
                "space-y-2 rounded-md border border-border bg-bg p-3",
                dragId === d.id && "opacity-50",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    className="cursor-grab text-fg-subtle active:cursor-grabbing"
                    aria-label="Reihenfolge ändern"
                    draggable={false}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <p className="truncate font-mono text-primary">https://{d.host}</p>
                </div>
                <div className="flex items-center gap-1">
                  {d.connected ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Aktiv
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      {checking === d.id ? "Prüfe DNS…" : "DNS ausstehend"}
                    </Badge>
                  )}
                  {d.connected ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const s = (await updateTenantDomain({
                          data: { id: d.id, connected: false, tenant_id: data.tenant.id },
                        })) as FullState;
                        patch(s);
                      }}
                    >
                      Trennen
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={checking === d.id}
                      onClick={() => void checkDns(d.id)}
                    >
                      {checking === d.id ? "…" : "Aktualisieren"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const s = (await removeTenantDomain({
                        data: { id: d.id, tenant_id: data.tenant.id },
                      })) as FullState;
                      patch(s);
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
                  }).then((s) => patch(s as FullState));
                }}
                onCreate={async (name, color) => {
                  const s = (await createTag({
                    data: { name, color, tenant_id: data.tenant.id },
                  })) as FullState;
                  patch(s);
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
