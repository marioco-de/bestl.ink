import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  superGetAdmin,
  superSavePlan,
  superDeletePlan,
  superAssignPlan,
  superSetFeature,
  superUpdateTenant,
  superUpdateUser,
  superResetPassword,
  superSetMemberRole,
} from "@/lib/docbay/api";
import { FEATURE_LABELS } from "@/lib/docbay/features";
import { FEATURE_KEYS, type FeatureKey, type FeatureMap } from "@/lib/docbay/types";
import type { SuperAdminPayload, SuperTenantRow, SuperUserRow } from "@/lib/docbay/types";
import { PLAN_KIND_LABELS, emptyFeatureMap, type Plan, type PlanKind } from "@/lib/docbay/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { FullScreenModal } from "@/components/ui/fullscreen-modal";
import { formatDateDe } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2,
  KeyRound,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/control/customers")({
  loader: async () => {
    try {
      return (await superGetAdmin()) as SuperAdminPayload;
    } catch {
      throw redirect({ to: "/control", search: {} });
    }
  },
  component: CustomersPage,
});

type Tab = "kunden" | "nutzer" | "plaene";

function CustomersPage() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState<SuperAdminPayload>(initial);
  const [tab, setTab] = useState<Tab>("kunden");
  const [q, setQ] = useState("");

  async function apply(next: SuperAdminPayload) {
    setData(next);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Kundenverwaltung
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Workspaces, Nutzer, Rechtegruppen – AppSumo-Tiers und Monatspakete.
        </p>
      </div>



      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-bg-elevated p-1">
          {(
            [
              ["kunden", "Kunden", Building2],
              ["nutzer", "Nutzer", Users],
              ["plaene", "Rechtegruppen", Layers],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-2 text-sm font-medium text-primary"
                  : "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg"
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            className="pl-9"
            placeholder="Suchen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {tab === "kunden" && (
        <KundenTab data={data} q={q} onChange={apply} />
      )}
      {tab === "nutzer" && (
        <NutzerTab data={data} q={q} onChange={apply} />
      )}
      {tab === "plaene" && (
        <PlaeneTab data={data} q={q} onChange={apply} />
      )}
    </div>
  );
}

function KundenTab({
  data,
  q,
  onChange,
}: {
  data: SuperAdminPayload;
  q: string;
  onChange: (d: SuperAdminPayload) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<SuperTenantRow | null>(null);
  const needle = q.trim().toLowerCase();
  const rows = data.tenants.filter((t) => {
    if (!needle) return true;
    const blob = [
      t.tenant.name,
      t.tenant.public_host,
      t.tenant.custom_domain,
      t.plan_name,
      ...t.owners.map((o) => `${o.email} ${o.name}`),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(needle);
  });

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-fg-muted">
            Keine Kunden. Sobald sich jemand registriert, erscheint der Workspace hier.
          </CardContent>
        </Card>
      )}
      {rows.map((row) => (
        <Card key={row.tenant.id}>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.tenant.name}</p>
                  {row.tenant.suspended && <Badge variant="danger">Gesperrt</Badge>}
                  {row.plan_name && (
                    <Badge variant="secondary">
                      {row.plan_kind ? `${PLAN_KIND_LABELS[row.plan_kind as PlanKind] ?? row.plan_kind} · ` : ""}
                      {row.plan_name}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-xs text-fg-subtle">
                  {row.tenant.public_host}
                  {row.tenant.custom_domain ? ` · ${row.tenant.custom_domain}` : ""}
                </p>
                <p className="mt-1 text-xs text-fg-muted">
                  {row.memberCount} Nutzer · {row.linkCount} Links ·{" "}
                  {row.owners.map((o) => o.email || o.name).join(", ") || "kein Owner"}
                </p>
                {row.tenant.notes && (
                  <p className="mt-1 text-xs text-fg-subtle">{row.tenant.notes}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-10 rounded-lg border border-border bg-bg-elevated px-2 text-sm"
                  value={row.plan_id ?? ""}
                  disabled={busy === `plan:${row.tenant.id}`}
                  onChange={async (e) => {
                    const planId = e.target.value || null;
                    setBusy(`plan:${row.tenant.id}`);
                    try {
                      onChange(
                        await superAssignPlan({
                          data: { tenant_id: row.tenant.id, plan_id: planId },
                        }),
                      );
                      toast.success("Paket zugewiesen – Features übernommen");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Fehler");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <option value="">Kein Paket</option>
                  {data.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {PLAN_KIND_LABELS[p.kind]} · {p.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" onClick={() => setEdit(row)}>
                  <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/control" search={{ tenant: row.tenant.id } as never}>
                    Öffnen
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_KEYS.map((key) => {
                const on = row.features[key];
                const id = `${row.tenant.id}:${key}`;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy === id}
                    className={
                      on
                        ? "rounded-lg border border-primary/40 bg-primary/10 px-2 py-2 text-left text-xs"
                        : "rounded-lg border border-border px-2 py-2 text-left text-xs text-fg-muted"
                    }
                    onClick={async () => {
                      setBusy(id);
                      try {
                        onChange(
                          await superSetFeature({
                            data: {
                              tenant_id: row.tenant.id,
                              feature_key: key,
                              enabled: !on,
                            },
                          }),
                        );
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Fehler");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {FEATURE_LABELS[key]} · {on ? "an" : "aus"}
                  </button>
                );
              })}
            </div>
            {row.owners.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {row.owners.map((o) => (
                  <div
                    key={o.user_id}
                    className="flex items-center gap-2 rounded-lg border border-border px-2 py-1 text-xs"
                  >
                    <span className="text-fg-muted">{o.email || o.name}</span>
                    <select
                      className="rounded border-0 bg-transparent text-xs"
                      value={o.role}
                      onChange={async (e) => {
                        try {
                          onChange(
                            await superSetMemberRole({
                              data: {
                                tenant_id: row.tenant.id,
                                user_id: o.user_id,
                                role: e.target.value as "owner" | "admin" | "member",
                              },
                            }),
                          );
                          toast.success("Rolle geändert");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Fehler");
                        }
                      }}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {edit && (
        <TenantEdit
          row={edit}
          onClose={() => setEdit(null)}
          onSaved={(d) => {
            onChange(d);
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function TenantEdit({
  row,
  onClose,
  onSaved,
}: {
  row: SuperTenantRow;
  onClose: () => void;
  onSaved: (d: SuperAdminPayload) => void;
}) {
  const [name, setName] = useState(row.tenant.name);
  const [notes, setNotes] = useState(row.tenant.notes);
  const [suspended, setSuspended] = useState(row.tenant.suspended);
  const [busy, setBusy] = useState(false);

  return (
    <FullScreenModal
      title="Workspace bearbeiten"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            className="min-h-11"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                onSaved(
                  await superUpdateTenant({
                    data: {
                      tenant_id: row.tenant.id,
                      name,
                      notes,
                      suspended,
                    },
                  }),
                );
                toast.success("Gespeichert");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Fehler");
              } finally {
                setBusy(false);
              }
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Interne Notiz</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={suspended}
          onChange={(e) => setSuspended(e.target.checked)}
        />
        Workspace sperren
      </label>
    </FullScreenModal>
  );
}

function NutzerTab({
  data,
  q,
  onChange,
}: {
  data: SuperAdminPayload;
  q: string;
  onChange: (d: SuperAdminPayload) => void;
}) {
  const [edit, setEdit] = useState<SuperUserRow | null>(null);
  const [pwUser, setPwUser] = useState<SuperUserRow | null>(null);
  const needle = q.trim().toLowerCase();
  const rows = data.users.filter((u) => {
    if (!needle) return true;
    return `${u.email} ${u.name} ${u.workspaces.map((w) => w.tenant_name).join(" ")}`
      .toLowerCase()
      .includes(needle);
  });

  return (
    <div className="space-y-3">
      {rows.map((u) => (
        <Card key={u.user_id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{u.name || "—"}</p>
                {u.is_super_admin && <Badge>Super Admin</Badge>}
              </div>
              <p className="font-mono text-xs text-fg-subtle">{u.email}</p>
              <p className="mt-1 text-xs text-fg-muted">
                {u.workspaces.length
                  ? u.workspaces.map((w) => `${w.tenant_name} (${w.role})`).join(" · ")
                  : "kein Workspace"}
                {" · "}
                seit {formatDateDe(u.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEdit(u)}>
                <Pencil className="h-3.5 w-3.5" /> Bearbeiten
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPwUser(u)}>
                <KeyRound className="h-3.5 w-3.5" /> Passwort
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {edit && (
        <UserEdit
          user={edit}
          onClose={() => setEdit(null)}
          onSaved={(d) => {
            onChange(d);
            setEdit(null);
          }}
        />
      )}
      {pwUser && (
        <PasswordReset
          user={pwUser}
          onClose={() => setPwUser(null)}
          onSaved={(d) => {
            onChange(d);
            setPwUser(null);
          }}
        />
      )}
    </div>
  );
}

function UserEdit({
  user,
  onClose,
  onSaved,
}: {
  user: SuperUserRow;
  onClose: () => void;
  onSaved: (d: SuperAdminPayload) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [busy, setBusy] = useState(false);
  return (
    <FullScreenModal
      title="Nutzer bearbeiten"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            className="min-h-11"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                onSaved(
                  await superUpdateUser({
                    data: { user_id: user.user_id, name, email },
                  }),
                );
                toast.success("Nutzer gespeichert");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Fehler");
              } finally {
                setBusy(false);
              }
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>E-Mail</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
    </FullScreenModal>
  );
}

function PasswordReset({
  user,
  onClose,
  onSaved,
}: {
  user: SuperUserRow;
  onClose: () => void;
  onSaved: (d: SuperAdminPayload) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function randomPw() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setPassword(s);
  }

  return (
    <FullScreenModal
      title="Passwort setzen"
      description={`Neues Passwort für ${user.email}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            className="min-h-11"
            disabled={busy || password.length < 8}
            onClick={async () => {
              setBusy(true);
              try {
                onSaved(
                  await superResetPassword({
                    data: { user_id: user.user_id, password },
                  }),
                );
                await navigator.clipboard.writeText(password).catch(() => undefined);
                toast.success("Passwort gesetzt (in Zwischenablage)");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Fehler");
              } finally {
                setBusy(false);
              }
            }}
          >
            Setzen
          </Button>
        </>
      }
    >
      <div>
        <Label>Neues Passwort (min. 8)</Label>
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <Button type="button" variant="secondary" onClick={randomPw}>
        Zufallspasswort
      </Button>
    </FullScreenModal>
  );
}

function PlaeneTab({
  data,
  q,
  onChange,
}: {
  data: SuperAdminPayload;
  q: string;
  onChange: (d: SuperAdminPayload) => void;
}) {
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const needle = q.trim().toLowerCase();
  const rows = data.plans.filter((p) =>
    needle ? `${p.name} ${p.slug} ${p.kind}`.toLowerCase().includes(needle) : true,
  );
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data.tenants) {
      if (t.plan_id) m.set(t.plan_id, (m.get(t.plan_id) ?? 0) + 1);
    }
    return m;
  }, [data.tenants]);

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing("new")}>
        <Plus className="h-4 w-4" /> Neue Rechtegruppe
      </Button>
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((p) => {
          const onCount = FEATURE_KEYS.filter((k) => p.features[k]).length;
          return (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      <Badge variant="secondary">{PLAN_KIND_LABELS[p.kind]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-fg-muted">{p.description || "—"}</p>
                    <p className="mt-1 text-xs text-fg-subtle">
                      {onCount} Features · {usage.get(p.id) ?? 0} Workspaces
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Gruppe „${p.name}“ löschen?`)) return;
                        try {
                          onChange(await superDeletePlan({ data: { id: p.id } }));
                          toast.success("Gelöscht");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Fehler");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {editing && (
        <PlanEditor
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(d) => {
            onChange(d);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PlanEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSaved: (d: SuperAdminPayload) => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? "custom");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [features, setFeatures] = useState<FeatureMap>(
    plan?.features ?? emptyFeatureMap(),
  );
  const [busy, setBusy] = useState(false);

  return (
    <FullScreenModal
      title={plan ? "Rechtegruppe bearbeiten" : "Neue Rechtegruppe"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            className="min-h-11"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                onSaved(
                  await superSavePlan({
                    data: {
                      id: plan?.id,
                      name: name.trim(),
                      kind,
                      description,
                      features,
                    },
                  }),
                );
                toast.success("Rechtegruppe gespeichert");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Fehler");
              } finally {
                setBusy(false);
              }
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div>
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="AppSumo Tier 4"
          required
        />
      </div>
      <div>
        <Label>Art</Label>
        <select
          className="flex h-11 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as PlanKind)}
        >
          <option value="appsumo">AppSumo</option>
          <option value="monthly">Monatlich</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Label>Features</Label>
        <FeaturePick
          features={features}
          onChange={setFeatures}
        />
      </div>
    </FullScreenModal>
  );
}

function FeaturePick({
  features,
  onChange,
}: {
  features: FeatureMap;
  onChange: (f: FeatureMap) => void;
}) {
  const [q, setQ] = useState("");
  const keys = FEATURE_KEYS.filter((k) => {
    const n = q.trim().toLowerCase();
    if (!n) return true;
    return FEATURE_LABELS[k].toLowerCase().includes(n) || k.includes(n);
  });
  return (
    <div className="space-y-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Features suchen…"
      />
      <div className="grid gap-1 sm:grid-cols-2">
        {keys.map((k) => (
          <label
            key={k}
            className="flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-bg-subtle"
          >
            <input
              type="checkbox"
              checked={features[k]}
              onChange={(e) => onChange({ ...features, [k]: e.target.checked })}
            />
            {FEATURE_LABELS[k as FeatureKey]}
          </label>
        ))}
        {keys.length === 0 && (
          <p className="text-xs text-fg-muted">Kein Feature zu „{q}“.</p>
        )}
      </div>
    </div>
  );
}

