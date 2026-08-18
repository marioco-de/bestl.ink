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
  vercelDomainSetup,
} from "@/lib/docbay/api";
import { PLATFORM_LINK_HOST, CNAME_TARGET } from "@/lib/docbay/brand";
import { TagPicker } from "@/components/control/tag-picker";
import type { FullState, TenantDomain } from "@/lib/docbay/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { QuickShorten } from "@/components/control/quick-shorten";

export const Route = createFileRoute("/control/domain")({
  component: DomainPage,
});

function DomainPage() {
  const t = useT();
  const data = useControlData();
  const setGlobal = useSetControlData();
  const [company, setCompany] = useState(data.tenant.brand_company || data.tenant.name);
  const [subdomain, setSubdomain] = useState(data.tenant.subdomain || data.tenant.slug);
  const [newHost, setNewHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [vercelReady, setVercelReady] = useState<boolean | null>(null);
  const [vercelHint, setVercelHint] = useState("");
  const scanned = useRef<string>("");

  useEffect(() => {
    void vercelDomainSetup()
      .then((s) => {
        setVercelReady(s.ready);
        const fail = s.registered.find((r) => !r.ok);
        setVercelHint(
          s.ready
            ? fail
              ? `${fail.host}: ${fail.detail}`
              : ""
            : s.lastError || t("domain.vercelMissing"),
        );
      })
      .catch(() => {
        setVercelReady(false);
        setVercelHint(t("domain.vercelMissing"));
      });
  }, [t]);

  useEffect(() => {
    setCompany(data.tenant.brand_company || data.tenant.name);
    setSubdomain(data.tenant.subdomain || data.tenant.slug);
  }, [data]);

  function patch(next: FullState) {
    setGlobal?.(next);
  }

  function patchDomain(domain: TenantDomain) {
    if (!setGlobal) return;
    const domains = data.domains.map((d) => (d.id === domain.id ? domain : d));
    setGlobal({ ...data, domains });
  }

  async function checkDns(id: string, silent = false) {
    setChecking(id);
    try {
      const res = await verifyTenantDomain({
        data: { id, tenant_id: data.tenant.id },
      });
      patchDomain(res.domain);
      if (!silent) {
        if (res.ok) toast.success(t("domain.dnsOk"));
        else toast.message(res.detail || t("domain.dnsWait"));
      }
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Prüfung fehlgeschlagen");
    } finally {
      setChecking((cur) => (cur === id ? null : cur));
    }
  }

  async function activate(id: string) {
    setBusy(true);
    try {
      const s = (await updateTenantDomain({
        data: { id, connected: true, tenant_id: data.tenant.id },
      })) as FullState;
      patch(s);
      toast.success(t("domain.nowActive"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const key = `${data.tenant.id}:${data.domains.map((d) => d.id).join(",")}`;
    if (scanned.current === key) return;
    const pending = data.domains.filter((d) => !d.connected && !d.dns_ok);
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
          name: company.trim(),
          brand_company: company.trim(),
          subdomain: subdomain.trim(),
          tenant_id: data.tenant.id !== "platform" ? data.tenant.id : undefined,
        },
      })) as FullState;
      patch({
        ...s,
        workspaces: s.workspaces.map((w) =>
          w.id === s.tenant.id
            ? { ...w, name: s.tenant.name, subdomain: s.tenant.subdomain }
            : w,
        ),
      });
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
      toast.success(t("domain.added"));
      const added = s.domains.find(
        (d) => d.host === host.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase(),
      );
      if (added) void checkDns(added.id, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
      toast.error(err instanceof Error ? err.message : t("common.error"));
    });
  }

  if (data.tenant.id === "platform") {
    return (
      <div className="mx-auto max-w-lg text-sm text-fg-muted">
        {t("domain.pickWorkspace")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t("domain.title")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("domain.hint")}</p>
        {vercelReady === false && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-fg-muted">
            {vercelHint || t("domain.vercelMissing")}
          </p>
        )}
        {vercelReady && vercelHint && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-fg-muted">
            {vercelHint}
          </p>
        )}
      </div>

      <QuickShorten />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" /> {t("domain.hosts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-bg p-3">
            <p className="text-xs uppercase text-fg-subtle">{t("domain.platform")}</p>
            <p className="mt-1 font-mono text-primary">https://{PLATFORM_LINK_HOST}/…</p>
          </div>
          {data.domains.map((d, i) => (
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
                "relative space-y-2 rounded-md border bg-bg p-3",
                i === 0 ? "border-primary/45" : "border-border",
                dragId === d.id && "opacity-50",
              )}
            >
              {i === 0 && (
                <span className="absolute bottom-0 right-3 z-10 flex h-5 translate-y-1/2 items-center rounded-sm border border-border bg-bg-elevated px-1.5 text-[10px] font-medium tracking-wide text-fg-muted">
                  {t("domain.standard")}
                </span>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    className="cursor-grab text-fg-subtle active:cursor-grabbing"
                    aria-label={t("domain.reorder")}
                    draggable={false}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <p className="truncate font-mono text-primary">https://{d.host}</p>
                </div>
                <div className="flex items-center gap-1">
                  {d.connected ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> {t("domain.active")}
                    </Badge>
                  ) : d.dns_ok ? (
                    <Badge variant="secondary">{t("domain.dnsReady")}</Badge>
                  ) : (
                    <Badge variant="warning">
                      {checking === d.id ? t("domain.checking") : t("domain.dnsPending")}
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
                      {t("domain.disconnect")}
                    </Button>
                  ) : d.dns_ok ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void activate(d.id)}
                    >
                      {t("domain.activate")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={checking === d.id}
                      onClick={() => void checkDns(d.id)}
                    >
                      {checking === d.id ? t("common.loading") : t("domain.refresh")}
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
                      toast.success(t("domain.removed"));
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
                    toast.success(t("common.copy"));
                  }}
                >
                  <Copy className="h-3 w-3" /> {t("domain.cname")}
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
              <Plus className="h-4 w-4" /> {t("domain.add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("domain.workspace")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveBrand} className="space-y-4">
            <div>
              <Label>{t("common.name")}</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label>{t("domain.slug")}</Label>
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
              {t("common.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
