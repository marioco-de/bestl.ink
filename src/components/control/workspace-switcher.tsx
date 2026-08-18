import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createWorkspace, getState } from "@/lib/docbay/api";
import { useControl } from "@/lib/docbay/control-store";
import type { FullState } from "@/lib/docbay/types";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({
  data,
  compact,
}: {
  data: FullState;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const { setData } = useControl();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const list = data.workspaces.length
    ? data.workspaces
    : [{ id: data.tenant.id, name: data.tenant.name, subdomain: data.tenant.subdomain, role: data.member.role }];

  async function go(id: string) {
    setOpen(false);
    if (id === data.tenant.id) return;
    try {
      const next = (await getState({ data: { tenant_id: id } })) as FullState;
      setData(next);
      void navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, tenant: id }),
      } as never);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Workspace nicht geladen");
    }
  }

  async function create() {
    if (!company.trim()) {
      toast.error("Name erforderlich");
      return;
    }
    setBusy(true);
    try {
      const next = (await createWorkspace({
        data: { company: company.trim() },
      })) as FullState;
      setData(next);
      toast.success("Workspace angelegt");
      setCreating(false);
      setCompany("");
      setOpen(false);
      void navigate({
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          tenant: next.tenant.id,
        }),
      } as never);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-subtle",
          compact && "min-h-11",
        )}
        aria-expanded={open}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{data.tenant.name}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-fg-subtle" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Schließen"
            onClick={() => {
              setOpen(false);
              setCreating(false);
            }}
          />
          <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-border bg-bg-elevated shadow-lg">
            <ul className="max-h-56 overflow-y-auto py-1">
              {list.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg-subtle"
                    onClick={() => go(w.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    {w.id === data.tenant.id && <Check className="h-3 w-3 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-2">
              {creating ? (
                <div className="space-y-2">
                  <Label>Neuer Workspace</Label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Firma oder Projekt"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void create();
                      }
                    }}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-8 flex-1" disabled={busy} onClick={() => void create()}>
                      {busy ? "…" : "Anlegen"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setCreating(false)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-fg-muted hover:bg-bg-subtle hover:text-fg"
                  onClick={() => setCreating(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Weiteren Workspace
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
